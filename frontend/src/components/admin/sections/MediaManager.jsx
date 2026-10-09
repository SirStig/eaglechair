import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check, FileText, History, Image as ImageIcon, Images, LayoutGrid, List, Loader2, Pencil, Search, Trash2,
  Upload, X,
} from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import PaginationBar from '../PaginationBar';
import MediaDetailPanel from '../media/MediaDetailPanel';
import ImageEditor from '../media/editor/ImageEditor';
import { DOC_KIND_LABELS, errorMessage, formatDate, formatSize, isEditableImage, usageSummary } from '../media/mediaFormat';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminPermissions, PERMISSIONS } from '../../../hooks/useAdminPermissions';
import { deleteMediaFiles, listMedia } from '../../../services/mediaManagerService';
import { uploadDocument } from '../../../services/documentLibraryService';
import { uploadImage } from '../../../utils/imageUpload';
import { resolveImageUrl } from '../../../utils/apiHelpers';

const TABS = [
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'document', label: 'Documents', icon: FileText },
];

const USAGE = [
  { value: 'all', label: 'All' },
  { value: 'used', label: 'In use' },
  { value: 'unused', label: 'Unused' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'size', label: 'Largest first' },
  { value: 'usage', label: 'Most used' },
];

const DEFAULT_FILTERS = { q: '', folder: '', usage: 'all', usedByType: '', docKind: '', sort: 'newest' };

const SELECT =
  'min-w-0 rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

const CHECKER =
  'bg-dark-900 bg-[length:16px_16px] bg-[linear-gradient(45deg,#1f1f1f_25%,transparent_25%),linear-gradient(-45deg,#1f1f1f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f1f_75%),linear-gradient(-45deg,transparent_75%,#1f1f1f_75%)]';

const DOCUMENT_TYPES = /\.(pdf|docx?|zip)$/i;

const VIEW_KEY = 'admin.media.view';
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

function Thumb({ item, kind, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (kind === 'document') {
    return item.cover_url && !failed ? (
      <img src={resolveImageUrl(item.cover_url)} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} onError={() => setFailed(true)} />
    ) : (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1 text-dark-300 ${className}`}>
        <FileText className="h-8 w-8" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{DOC_KIND_LABELS[item.kind] || item.filename.split('.').pop()}</span>
      </div>
    );
  }
  return (
    <img
      src={resolveImageUrl(failed ? item.url : item.thumbnail_url || item.url)}
      alt=""
      loading="lazy"
      decoding="async"
      className={`h-full w-full object-contain ${className}`}
      onError={() => !failed && setFailed(true)}
    />
  );
}

function StatPill({ label, value, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-primary-500/60 bg-primary-500/10' : 'border-white/[0.06] bg-dark-800/60'} ${onClick ? 'hover:border-white/[0.16]' : ''}`}
    >
      <p className="text-[11px] uppercase tracking-wider text-dark-300">{label}</p>
      <p className="text-base font-semibold tabular-nums text-dark-50">{value}</p>
    </Tag>
  );
}

/**
 * Admin Media Library: every uploaded image and document, where each is used,
 * search / filters, bulk delete, replace with version history, and the
 * built-in image editor. Deep links: ?type=document&file=<url>.
 */
export default function MediaManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAdminPermissions();
  const canEdit = can(PERMISSIONS.EDIT_CATALOG);
  const canDelete = can(PERMISSIONS.DELETE);

  const params = new URLSearchParams(location.search);
  const kind = params.get('type') === 'document' ? 'document' : 'image';
  const openUrl = params.get('file');

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(readView);
  const [selected, setSelected] = useState(() => new Set());
  const [uploadFolder, setUploadFolder] = useState('general');
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDetach, setBulkDetach] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [panelKey, setPanelKey] = useState(0);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);
  const seq = useRef(0);

  const setParams = useCallback((changes, replace = false) => {
    const next = new URLSearchParams(location.search);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace });
  }, [location.pathname, location.search, navigate]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === query.trim() ? f : { ...f, q: query.trim() }));
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // New tab: fresh filters and selection
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setQuery('');
    setPage(1);
    setSelected(new Set());
    setUploadFolder(kind === 'image' ? 'general' : 'catalogs');
  }, [kind]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listMedia(kind, { ...filters, page, pageSize });
      if (mine === seq.current) setData(res);
    } catch (err) {
      if (mine === seq.current) setError(errorMessage(err, 'Could not load the library'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [kind, filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const changeView = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Storage unavailable: the choice lasts this visit
    }
  };

  const items = useMemo(() => data?.items || [], [data]);
  const total = data?.total || 0;
  const summary = data?.summary;
  const filtered = filters.folder || filters.usedByType || filters.usage !== 'all' || filters.docKind || filters.q;

  // ---- selection ------------------------------------------------------------
  const toggle = (url) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    return next;
  });
  const allOnPage = items.length > 0 && items.every((i) => selected.has(i.url));
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allOnPage) items.forEach((i) => next.delete(i.url));
    else items.forEach((i) => next.add(i.url));
    return next;
  });
  const selectedItems = items.filter((i) => selected.has(i.url));
  const selectedInUse = selectedItems.filter((i) => i.used_by.length).length;

  const bulkDelete = async () => {
    setBulkBusy(true);
    try {
      const res = await deleteMediaFiles(kind, [...selected], { detach: bulkDetach });
      if (res.deleted.length) toast.success(`Deleted ${res.deleted.length} file${res.deleted.length === 1 ? '' : 's'}`);
      if (res.failed.length) toast.warning(`${res.failed.length} not deleted: ${res.failed[0].detail}`, 9000);
      setSelected(new Set(res.failed.map((f) => f.url)));
      setBulkConfirm(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Delete failed'));
    } finally {
      setBulkBusy(false);
    }
  };

  // ---- uploads ----------------------------------------------------------------
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) =>
      kind === 'image' ? f.type.startsWith('image/') : DOCUMENT_TYPES.test(f.name));
    if (!files.length) {
      toast.warning(kind === 'image' ? 'Drop image files here' : 'Drop PDF, Word or ZIP files here');
      return;
    }
    const batch = files.map((file) => ({ id: `${file.name}-${Math.random()}`, name: file.name, status: 'uploading' }));
    setUploads((prev) => [...batch, ...prev]);
    let done = 0;
    await Promise.all(files.map(async (file, idx) => {
      try {
        if (kind === 'image') await uploadImage(file, uploadFolder);
        else await uploadDocument(file, uploadFolder);
        done += 1;
        setUploads((prev) => prev.filter((u) => u.id !== batch[idx].id));
      } catch (err) {
        setUploads((prev) => prev.map((u) => (u.id === batch[idx].id ? { ...u, status: 'error', error: errorMessage(err, 'Upload failed') } : u)));
      }
    }));
    if (done) {
      toast.success(`Uploaded ${done} file${done === 1 ? '' : 's'} to ${uploadFolder}`);
      setFilters(DEFAULT_FILTERS);
      setQuery('');
      setPage(1);
      load();
    }
  };

  const onDragEnter = (e) => {
    if (!canEdit || !Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  };
  const onDrop = (e) => {
    if (!canEdit) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer?.files);
  };

  // ---- panel / editor -------------------------------------------------------
  const openFile = (url) => setParams({ file: url });
  const closePanel = useCallback(() => setParams({ file: null }), [setParams]);

  const onPanelChanged = ({ type, url, newUrl }) => {
    load();
    if (type === 'deleted') closePanel();
    else if (newUrl && newUrl !== url) setParams({ file: newUrl }, true);
    else setPanelKey((k) => k + 1);
  };

  const onEdited = ({ url: newUrl, mode, updated, note }) => {
    const n = updated?.length || 0;
    toast.success(
      mode === 'version'
        ? `Saved as a new version${n ? `; ${n} record${n === 1 ? '' : 's'} updated` : ''}.${note ? ` ${note}` : ''}`
        : `Saved a copy.${note ? ` ${note}` : ''}`,
    );
    load();
    setParams({ file: newUrl }, true);
  };

  const editFolder = (url) => url.replace(/^\/uploads\/images\//, '').split('/').slice(0, -1)[0] || 'general';

  // ---- render -----------------------------------------------------------------
  const folderOptions = data?.folders || [];
  const typeOptions = data?.types || [];
  const kindOptions = data?.kinds || [];
  const activeUploads = uploads.filter((u) => u.status === 'uploading').length;
  const failedUploads = uploads.filter((u) => u.status === 'error');

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Publishing"
        title="Media Library"
        icon={Images}
        description="Every uploaded image and document, where it’s used, and its version history. Replace or edit a file and everything using it updates."
        actions={canEdit && (
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-2 text-xs text-dark-300 sm:flex">
              Upload to
              <input
                list="media-folders"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                className="w-32 rounded-lg border border-dark-500 bg-dark-800 px-2 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none"
                aria-label="Upload folder"
              />
              <datalist id="media-folders">
                {folderOptions.filter((f) => f.name).map((f) => <option key={f.name} value={f.name} />)}
              </datalist>
            </label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-dark-900 hover:bg-primary-400"
            >
              {activeUploads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={kind === 'image' ? 'image/*' : '.pdf,.doc,.docx,.zip'}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-white/[0.08] bg-dark-800 p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={kind === t.id}
              onClick={() => setParams({ type: t.id === 'image' ? null : t.id, file: null })}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${kind === t.id ? 'bg-dark-600 text-dark-50' : 'text-dark-300 hover:text-dark-100'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        {summary && (
          <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
            <StatPill label="Files" value={summary.stored.toLocaleString()} />
            <StatPill label="Storage" value={formatSize(summary.bytes)} />
            <StatPill
              label="Unused"
              value={summary.unused.toLocaleString()}
              active={filters.usage === 'unused'}
              onClick={() => setFilter('usage', filters.usage === 'unused' ? 'all' : 'unused')}
            />
            {summary.linked > 0 && <StatPill label="Linked elsewhere" value={summary.linked.toLocaleString()} />}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-300" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'image' ? 'Search filename, product name, model number…' : 'Search filename, family, catalog…'}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2 pl-9 pr-3 text-sm text-dark-50 placeholder:text-dark-300 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <select value={filters.usedByType} onChange={(e) => setFilter('usedByType', e.target.value)} className={SELECT} aria-label="Used by">
            <option value="">Used by anything</option>
            {typeOptions.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
          </select>
          <select value={filters.folder} onChange={(e) => setFilter('folder', e.target.value)} className={SELECT} aria-label="Folder">
            <option value="">All folders</option>
            {folderOptions.map((f) => <option key={f.name || '(root)'} value={f.name}>{f.name || '(root)'} ({f.count})</option>)}
          </select>
          {kind === 'document' && (
            <select value={filters.docKind} onChange={(e) => setFilter('docKind', e.target.value)} className={SELECT} aria-label="File type">
              <option value="">All types</option>
              {kindOptions.map((k) => <option key={k.name} value={k.name}>{DOC_KIND_LABELS[k.name] || k.name} ({k.count})</option>)}
            </select>
          )}
          <div className="flex rounded-lg border border-dark-500 bg-dark-800 p-0.5" role="group" aria-label="Usage">
            {USAGE.map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setFilter('usage', u.value)}
                aria-pressed={filters.usage === u.value}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${filters.usage === u.value ? 'bg-dark-500 text-dark-50' : 'text-dark-300 hover:text-dark-100'}`}
              >
                {u.label}
              </button>
            ))}
          </div>
          <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className={SELECT} aria-label="Sort">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex rounded-lg border border-dark-500 bg-dark-800 p-0.5" role="group" aria-label="View">
            <button type="button" onClick={() => changeView('grid')} aria-pressed={view === 'grid'} className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-dark-500 text-dark-50' : 'text-dark-300'}`} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" onClick={() => changeView('list')} aria-pressed={view === 'list'} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-dark-500 text-dark-50' : 'text-dark-300'}`} aria-label="List view"><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Upload status */}
      {(activeUploads > 0 || failedUploads.length > 0) && (
        <div className="space-y-1 rounded-lg border border-dark-600 bg-dark-800/60 px-3 py-2 text-xs" aria-live="polite">
          {activeUploads > 0 && <p className="flex items-center gap-2 text-dark-100"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading {activeUploads} file{activeUploads === 1 ? '' : 's'}…</p>}
          {failedUploads.map((u) => (
            <p key={u.id} className="flex items-center gap-2 text-red-300">
              <span className="flex-1">{u.name}: {u.error}</span>
              <button type="button" onClick={() => setUploads((p) => p.filter((x) => x.id !== u.id))} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
            </p>
          ))}
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-primary-600/40 bg-dark-700/95 px-3 py-2 shadow-lg backdrop-blur">
          <span className="text-sm text-dark-50">{selected.size} selected</span>
          <button type="button" onClick={toggleAll} className="rounded-md px-2 py-1 text-xs text-dark-200 hover:bg-dark-600">{allOnPage ? 'Unselect page' : 'Select page'}</button>
          <div className="flex-1" />
          {canDelete && (
            <button type="button" onClick={() => { setBulkDetach(false); setBulkConfirm(true); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/30">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-sm text-dark-100 hover:bg-dark-600">Clear</button>
        </div>
      )}

      {/* Results */}
      <div className="relative min-h-[300px]" onDragEnter={onDragEnter} onDragOver={(e) => canEdit && e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
        {error && <p className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</p>}

        {loading && !data && (
          <div className="flex items-center justify-center py-20 text-sm text-dark-200"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…</div>
        )}

        {data && items.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-dark-500 py-16 text-center">
            {kind === 'image' ? <ImageIcon className="h-10 w-10 text-dark-400" /> : <FileText className="h-10 w-10 text-dark-400" />}
            <p className="text-sm text-dark-200">{filtered ? 'Nothing matches these filters.' : `No ${kind === 'image' ? 'images' : 'documents'} yet.`}</p>
            {filtered && (
              <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setQuery(''); }} className="rounded-lg bg-dark-600 px-3 py-2 text-sm text-dark-50 hover:bg-dark-500">Clear filters</button>
            )}
          </div>
        )}

        {items.length > 0 && view === 'grid' && (
          <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 ${loading ? 'opacity-60' : ''}`}>
            {items.map((item) => {
              const isSelected = selected.has(item.url);
              return (
                <li key={item.url} className="group relative">
                  <button
                    type="button"
                    onClick={() => openFile(item.url)}
                    className={`block w-full overflow-hidden rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isSelected ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-500 hover:border-dark-300'}`}
                  >
                    <div className={`relative aspect-square ${CHECKER}`}>
                      <Thumb item={item} kind={kind} />
                      <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
                        {item.versions > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-dark-950/85 px-1.5 py-0.5 text-[10px] font-medium text-dark-100" title={`${item.versions} earlier version${item.versions === 1 ? '' : 's'}`}>
                            <History className="h-3 w-3" /> {item.versions}
                          </span>
                        )}
                        {!item.on_disk && <span className="rounded bg-dark-950/85 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">Linked</span>}
                      </div>
                    </div>
                    <div className="space-y-0.5 bg-dark-800 px-2 py-1.5">
                      <p className="truncate text-xs font-medium text-dark-50" title={item.filename}>{item.filename}</p>
                      <p className={`truncate text-[11px] ${item.used_by.length ? 'text-dark-200' : 'text-amber-300/80'}`}>{usageSummary(item.used_by)}</p>
                    </div>
                  </button>
                  {/* Hover actions */}
                  <button
                    type="button"
                    onClick={() => toggle(item.url)}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? 'Unselect' : 'Select'}
                    className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded border transition-opacity ${isSelected ? 'border-primary-500 bg-primary-500 text-dark-900 opacity-100' : 'border-white/60 bg-dark-950/70 text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'} ${selected.size ? 'sm:opacity-100' : ''}`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  {kind === 'image' && canEdit && item.on_disk && isEditableImage(item.url) && (
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="absolute right-1.5 top-1.5 hidden h-7 items-center gap-1 rounded bg-dark-950/85 px-2 text-[11px] font-medium text-dark-50 hover:bg-primary-500 hover:text-dark-900 sm:group-hover:flex sm:focus:flex"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && view === 'list' && (
          <div className={`overflow-x-auto rounded-xl border border-white/[0.06] ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-dark-800 text-left text-[11px] uppercase tracking-wider text-dark-300">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} className="accent-primary-500" aria-label="Select page" />
                  </th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Folder</th>
                  <th className="px-3 py-2">Used by</th>
                  <th className="px-3 py-2 text-right">Size</th>
                  <th className="px-3 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {items.map((item) => (
                  <tr key={item.url} className={`cursor-pointer hover:bg-white/[0.02] ${selected.has(item.url) ? 'bg-primary-500/5' : ''}`} onClick={() => openFile(item.url)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.url)} onChange={() => toggle(item.url)} className="accent-primary-500" aria-label={`Select ${item.filename}`} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 shrink-0 overflow-hidden rounded ${CHECKER}`}><Thumb item={item} kind={kind} /></div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-dark-50">{item.filename}</p>
                          <p className="text-[11px] text-dark-300">
                            {item.versions > 0 && `${item.versions} earlier version${item.versions === 1 ? '' : 's'}`}
                            {!item.on_disk && 'Linked from outside the uploads folder'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-dark-200">{item.folder || '—'}</td>
                    <td className={`max-w-[260px] truncate px-3 py-2 ${item.used_by.length ? 'text-dark-100' : 'text-amber-300/80'}`} title={item.used_by.map((u) => `${u.type}: ${u.label}`).join('\n')}>
                      {usageSummary(item.used_by)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-dark-200">{item.on_disk ? formatSize(item.size) : '—'}</td>
                    <td className="px-3 py-2 text-dark-200">{formatDate(item.modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-dark-800/40">
            <PaginationBar
              page={page}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
              total={total}
              pageSize={pageSize}
              onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              position="bottom"
            />
          </div>
        )}

        {dragging && (
          <div className="pointer-events-none fixed inset-4 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary-500 bg-dark-900/85">
            <p className="flex items-center gap-2 text-base font-medium text-dark-50">
              <Upload className="h-5 w-5" /> Drop to upload to “{uploadFolder}”
            </p>
          </div>
        )}
      </div>

      {bulkConfirm && (
        <div className="fixed inset-0 z-[10045] flex items-end justify-center bg-black/60 p-3 sm:items-center" onMouseDown={() => !bulkBusy && setBulkConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl border border-dark-500 bg-dark-700 p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="alertdialog" aria-label="Delete files">
            <h3 className="text-base font-semibold text-dark-50">Delete {selected.size} file{selected.size === 1 ? '' : 's'}?</h3>
            <p className="mt-2 text-sm text-dark-200">They’ll be removed from the server along with their earlier versions.</p>
            {selectedInUse > 0 && (
              <label className="mt-3 flex items-start gap-2 rounded-lg bg-dark-800 p-2 text-sm text-dark-100">
                <input type="checkbox" checked={bulkDetach} onChange={(e) => setBulkDetach(e.target.checked)} className="mt-0.5 accent-red-500" />
                <span>{selectedInUse} {selectedInUse === 1 ? 'is' : 'are'} in use. Also remove {selectedInUse === 1 ? 'it' : 'them'} from those records (otherwise in-use files are skipped).</span>
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkConfirm(false)} disabled={bulkBusy} className="rounded-lg px-4 py-2 text-sm text-dark-100 hover:bg-dark-600">Cancel</button>
              <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {openUrl && (
        <MediaDetailPanel
          key={`${openUrl}-${panelKey}`}
          kind={kind}
          url={openUrl}
          onClose={closePanel}
          onChanged={onPanelChanged}
          onEdit={(d) => setEditing(d)}
          canEdit={canEdit}
          canDelete={canDelete}
          toast={toast}
        />
      )}

      <ImageEditor
        isOpen={Boolean(editing)}
        url={editing?.url}
        filename={editing?.filename}
        folder={editing ? editFolder(editing.url) : 'general'}
        canReplace={canEdit}
        onClose={() => setEditing(null)}
        onSaved={onEdited}
      />
    </AdminPage>
  );
}
