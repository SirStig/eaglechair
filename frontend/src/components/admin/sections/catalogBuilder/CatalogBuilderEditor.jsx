import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, Eye, GripVertical, Layers, Lightbulb, Loader2, Plus, Redo2,
  Settings, Trash2, Undo2, X,
} from 'lucide-react';
import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import { useToast } from '../../../../contexts/ToastContext';
import {
  exportCatalog, getProductsByIds, saveBlob, saveProject, suggestPages,
} from '../../../../services/catalogToolsService';
import PagePreview from './PagePreview';
import PageInspector from './PageInspector';
import { AddPageDialog, FamilyPicker } from './Pickers';
import {
  DEFAULT_SETTINGS, PAGE_TYPES, duplicatePage, newPage, normalizePage, pageSummary, referencedIds,
} from './pageModel';

const AUTOSAVE_MS = 1500;
const HISTORY_LIMIT = 80;
const COALESCE_MS = 1000;
const INPUT = 'w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-dark-50 focus:border-primary-500 outline-none';

/** Undo / redo over the document; rapid edits with the same key coalesce. */
const useHistory = (initial) => {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const last = useRef({ key: null, at: 0 });

  const set = useCallback((updater, key = null) => {
    setState((s) => {
      const next = typeof updater === 'function' ? updater(s.present) : updater;
      if (next === s.present) return s;
      const now = Date.now();
      const coalesce = key && last.current.key === key && now - last.current.at < COALESCE_MS;
      last.current = { key, at: now };
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => setState((s) => (s.past.length
    ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
    : s)), []);
  const redo = useCallback(() => setState((s) => (s.future.length
    ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
    : s)), []);

  return { document: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
};

const SortablePage = ({ page, index, active, onSelect, onDuplicate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const Icon = PAGE_TYPES[page.type]?.icon || Layers;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-2 text-sm ${
        active ? 'border-primary-500 bg-primary-500/10' : 'border-dark-700 bg-dark-800 hover:border-dark-500'
      } ${isDragging ? 'opacity-60 z-10' : ''}`}
    >
      <button type="button" className="text-dark-500 hover:text-dark-200 cursor-grab touch-none" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => onSelect(index)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
        <span className="text-[11px] text-dark-400 w-5 text-right">{index + 1}</span>
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-400' : 'text-dark-300'}`} />
        <span className="min-w-0">
          <span className="block truncate text-dark-100">{pageSummary(page)}</span>
          <span className="block text-[11px] text-dark-400">{PAGE_TYPES[page.type]?.label}</span>
        </span>
      </button>
      <div className="hidden group-hover:flex items-center">
        <button type="button" onClick={() => onDuplicate(index)} className="p-1 text-dark-400 hover:text-dark-100" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => onDelete(index)} className="p-1 text-dark-400 hover:text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};

/**
 * Catalog Builder editor: page list (drag to reorder), live server-rendered
 * preview with draggable photos, page inspector, undo/redo and autosave.
 */
const CatalogBuilderEditor = ({ project, onBack, onSaved }) => {
  const toast = useToast();
  const initial = useMemo(() => ({
    settings: { ...DEFAULT_SETTINGS, ...(project.document?.settings || {}) },
    pages: (project.document?.pages || []).map(normalizePage),
  }), [project]);
  const { document, set, undo, redo, canUndo, canRedo } = useHistory(initial);

  const [name, setName] = useState(project.name);
  const [pageIndex, setPageIndex] = useState(initial.pages.length ? 0 : null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [products, setProducts] = useState({});
  const [saveState, setSaveState] = useState('saved');
  const [busy, setBusy] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [tab, setTab] = useState('page');
  const [familyPicker, setFamilyPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const savedRef = useRef({ name: project.name, document: JSON.stringify(initial) });
  const loadingIds = useRef(new Set());

  const page = pageIndex != null ? document.pages[pageIndex] : null;

  // ---- product cache: fetch any product the pages refer to that we don't have yet
  useEffect(() => {
    const { products: ids } = referencedIds(document.pages);
    const missing = [...ids].filter((id) => !products[id] && !loadingIds.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => loadingIds.current.add(id));
    getProductsByIds(missing)
      .then((list) => setProducts((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) })))
      .catch(() => {})
      .finally(() => missing.forEach((id) => loadingIds.current.delete(id)));
  }, [document.pages, products]);

  const registerProduct = useCallback((product) => setProducts((prev) => ({ ...prev, [product.id]: product })), []);

  // ---- autosave
  const dirty = name !== savedRef.current.name || JSON.stringify(document) !== savedRef.current.document;
  useEffect(() => {
    if (!dirty) return undefined;
    setSaveState('unsaved');
    const timer = setTimeout(async () => {
      const snapshot = { name: name.trim() || 'Untitled catalog', document };
      setSaveState('saving');
      try {
        const saved = await saveProject(project.id, snapshot);
        savedRef.current = { name, document: JSON.stringify(document) };
        setSaveState('saved');
        onSaved?.(saved);
      } catch (error) {
        setSaveState('error');
        toast.error(error?.response?.data?.detail || 'Could not save the catalog');
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // toast / onSaved identities don't matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, name, dirty, project.id]);

  useEffect(() => {
    const warn = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ---- keyboard shortcuts (outside text fields, which keep their own undo)
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
      if (!(e.metaKey || e.ctrlKey) || typing) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Keep the selection valid after undo / deletes
  useEffect(() => {
    if (pageIndex != null && pageIndex >= document.pages.length) {
      setPageIndex(document.pages.length ? document.pages.length - 1 : null);
    }
  }, [document.pages.length, pageIndex]);

  // ---- page operations
  const setPages = (updater, key) => set((doc) => ({ ...doc, pages: updater(doc.pages) }), key);

  /** Patch the selected page; changes is a partial page or (page) => partial page. */
  const updatePage = (changes) => {
    if (pageIndex == null) return;
    const pageId = document.pages[pageIndex]?.id;
    const fields = typeof changes === 'object' ? Object.keys(changes).join(',') : 'items';
    setPages((pages) => pages.map((p, i) => {
      if (i !== pageIndex) return p;
      const patch = typeof changes === 'function' ? changes(p) : changes;
      return { ...p, ...patch };
    }), `page:${pageId}:${fields}`);
  };

  const insertPages = (newPages) => {
    const at = pageIndex == null ? document.pages.length : pageIndex + 1;
    setPages((pages) => [...pages.slice(0, at), ...newPages, ...pages.slice(at)]);
    setPageIndex(at);
    setSelectedItem(null);
  };

  const addPage = (type) => insertPages([newPage(type)]);

  const selectPage = (index) => {
    setPageIndex(index);
    setSelectedItem(null);
  };

  // Clicking a photo on the preview opens it in the Products tab
  const selectItem = (index) => {
    setSelectedItem(index);
    if (index != null && page?.type !== 'photo') setTab('products');
  };

  const hasContentPages = document.pages.some((p) => p.type === 'product' || p.type === 'gallery');

  const addFamilies = async (familyIds, includeGallery) => {
    try {
      const { pages } = await suggestPages({ family_ids: familyIds, include_gallery: includeGallery });
      if (!pages.length) {
        toast.warning('Those families have no products yet.');
        return;
      }
      insertPages(pages.map(normalizePage));
      toast.success(`Added ${pages.length} page${pages.length === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not build the family pages');
    }
  };

  const deletePage = (index) => {
    setPages((pages) => pages.filter((_, i) => i !== index));
    setSelectedItem(null);
    if (pageIndex != null && index < pageIndex) setPageIndex(pageIndex - 1);
  };

  const duplicateAt = (index) => {
    setPages((pages) => [...pages.slice(0, index + 1), duplicatePage(pages[index]), ...pages.slice(index + 1)]);
    setPageIndex(index + 1);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = document.pages.map((p) => p.id);
    const reordered = arrayMove(document.pages, ids.indexOf(active.id), ids.indexOf(over.id));
    const selectedId = page?.id;
    setPages(() => reordered);
    if (selectedId) setPageIndex(reordered.findIndex((p) => p.id === selectedId));
  };

  // ---- photo adjustments from the preview (photo pages keep them on the page itself)
  const getAdjust = (index) => {
    const target = page?.type === 'photo' ? page : page?.items?.[index];
    return { dx: target?.dx || 0, dy: target?.dy || 0, scale: target?.scale || 1 };
  };
  const onAdjust = (index, values) => {
    if (page?.type === 'photo') updatePage(values);
    else updatePage((p) => ({ items: p.items.map((it, i) => (i === index ? { ...it, ...values } : it)) }));
  };

  const setSetting = (key, value, coalesce = true) =>
    set((d) => ({ ...d, settings: { ...d.settings, [key]: value } }), coalesce ? `settings:${key}` : null);

  // ---- export
  const fileName = `${name.trim() || 'Eagle Chair Catalog'}.pdf`;
  const renderPdf = () => exportCatalog(document, { filename: name, projectId: project.id });

  const download = async () => {
    setBusy('export');
    try {
      saveBlob(await renderPdf(), fileName);
    } catch {
      toast.error('Export failed');
    } finally {
      setBusy(null);
    }
  };

  const previewAll = async () => {
    setBusy('preview');
    try {
      const blob = await renderPdf();
      setPdfUrl(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })));
    } catch {
      toast.error('Could not build the PDF');
    } finally {
      setBusy(null);
    }
  };

  const closePdf = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  const saveLabel = {
    saved: 'All changes saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed, retrying on next change',
  }[saveState];

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Catalogs</Button>
        <input
          className="flex-1 min-w-[12rem] bg-transparent text-xl font-bold text-dark-50 border-b border-transparent hover:border-dark-600 focus:border-primary-500 outline-none px-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Catalog name"
        />
        <span className={`text-xs ${saveState === 'error' ? 'text-red-400' : 'text-dark-400'}`}>{saveLabel}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} className="p-2 rounded text-dark-200 hover:bg-dark-700 disabled:opacity-30" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} className="p-2 rounded text-dark-200 hover:bg-dark-700 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="p-2 rounded text-dark-200 hover:bg-dark-700" title="Catalog settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={previewAll} disabled={!!busy || !document.pages.length}>
          {busy === 'preview' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
          Preview PDF
        </Button>
        <Button size="sm" onClick={download} disabled={!!busy || !document.pages.length}>
          {busy === 'export' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_340px] gap-4 items-start">
        {/* Pages */}
        <div className="bg-dark-800/60 border border-dark-700 rounded-xl p-2 space-y-2 lg:sticky lg:top-2 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs uppercase tracking-wider text-dark-400 font-semibold">Pages ({document.pages.length})</span>
            <span className="text-[11px] text-dark-500">drag to reorder</span>
          </div>
          <Button size="xs" className="w-full" onClick={() => setAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add pages
          </Button>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={document.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {document.pages.map((p, index) => (
                  <SortablePage
                    key={p.id}
                    page={p}
                    index={index}
                    active={index === pageIndex}
                    onSelect={selectPage}
                    onDuplicate={duplicateAt}
                    onDelete={deletePage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!document.pages.length && (
            <p className="text-xs text-dark-400 p-2">
              Start with a cover and contents page, then add whole families or single product sheets.
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="min-w-0 flex flex-col items-center gap-3">
          {!hasContentPages && (
            <div className="w-full max-w-[640px] flex items-start gap-3 rounded-xl border border-primary-500/40 bg-primary-500/10 p-3">
              <Lightbulb className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-dark-100">
                <span className="font-medium">Next: add your products.</span>{' '}
                Pick product families and their sheets are built for you, ready to tweak.
              </div>
              <Button size="xs" onClick={() => setFamilyPicker(true)}>Add families</Button>
            </div>
          )}
          {page && (
            <div className="w-full max-w-[640px] flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => selectPage(pageIndex - 1)}
                disabled={pageIndex === 0}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-dark-200 hover:bg-dark-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-dark-300">
                {PAGE_TYPES[page.type]?.label} · page {pageIndex + 1} of {document.pages.length}
              </span>
              <button
                type="button"
                onClick={() => selectPage(pageIndex + 1)}
                disabled={pageIndex >= document.pages.length - 1}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-dark-200 hover:bg-dark-700 disabled:opacity-30"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {page ? (
            <PagePreview
              document={document}
              pageIndex={pageIndex}
              selectedItem={selectedItem}
              onSelectItem={selectItem}
              getAdjust={getAdjust}
              onAdjust={onAdjust}
            />
          ) : (
            <div className="w-full max-w-[640px] aspect-[612/792] border-2 border-dashed border-dark-600 rounded-xl flex items-center justify-center text-dark-400 text-sm">
              Add a page to start
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="bg-dark-800/60 border border-dark-700 rounded-xl p-4 lg:sticky lg:top-2 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {page ? (
            <PageInspector
              key={page.id}
              page={page}
              pageNumber={pageIndex + 1}
              tab={tab}
              onTabChange={setTab}
              products={products}
              onRegisterProduct={registerProduct}
              selectedItem={selectedItem}
              onSelectItem={selectItem}
              onChange={updatePage}
            />
          ) : (
            <p className="text-sm text-dark-400">Select a page on the left to edit it.</p>
          )}
        </div>
      </div>

      <AddPageDialog
        isOpen={addDialog}
        onClose={() => setAddDialog(false)}
        onAddType={addPage}
        onAddFamilies={() => setFamilyPicker(true)}
      />
      <FamilyPicker isOpen={familyPicker} onClose={() => setFamilyPicker(false)} onConfirm={addFamilies} />

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Catalog settings" size="sm">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-dark-200">PDF title</span>
            <input className={INPUT} value={document.settings.title} onChange={(e) => setSetting('title', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-dark-200">Copyright line</span>
            <input className={INPUT} value={document.settings.copyright} onChange={(e) => setSetting('copyright', e.target.value)} />
            <span className="block text-[11px] text-dark-400">{'{year}'} becomes the current year.</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-dark-200">
            <input
              type="checkbox"
              className="accent-primary-500"
              checked={document.settings.page_numbers}
              onChange={(e) => setSetting('page_numbers', e.target.checked, false)}
            />
            Print page numbers
          </label>
          <div className="flex justify-end"><Button size="sm" onClick={() => setSettingsOpen(false)}>Done</Button></div>
        </div>
      </Modal>

      {pdfUrl && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-dark-50 font-semibold">{name}</span>
            <div className="flex items-center gap-2">
              <a href={pdfUrl} download={fileName} className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary-500 text-dark-900 text-sm font-medium">
                <Download className="w-4 h-4 mr-1" /> Download
              </a>
              <button type="button" onClick={closePdf} className="p-2 text-dark-100 hover:text-white" aria-label="Close preview">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <iframe title="Catalog PDF preview" src={pdfUrl} className="flex-1 w-full rounded bg-white" />
        </div>,
        window.document.body,
      )}
    </div>
  );
};

export default CatalogBuilderEditor;
