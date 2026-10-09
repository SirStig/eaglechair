import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, File, FileArchive, FileSpreadsheet, FileText, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { deleteDocument, listDocuments, uploadDocument } from '../../../services/documentLibraryService';
import PDFViewerModal from '../../ui/PDFViewerModal';

const PAGE_SIZE = 60;

const USAGE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'used', label: 'In use' },
  { value: 'unused', label: 'Unused' },
];

// Kinds the server groups documents into, with what the upload endpoint accepts for each
const KIND_INFO = {
  pdf: { label: 'PDF', icon: FileText, accept: ['.pdf', 'application/pdf'] },
  word: { label: 'Word', icon: FileText, accept: ['.doc', '.docx'] },
  zip: { label: 'ZIP', icon: FileArchive, accept: ['.zip'] },
  cad: { label: 'CAD', icon: File, accept: [] },
  spreadsheet: { label: 'Spreadsheet', icon: FileSpreadsheet, accept: [] },
  other: { label: 'Other', icon: File, accept: [] },
};
const UPLOADABLE = /\.(pdf|docx?|zip)$/i;

const extensionOf = (name = '') => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase();

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (seconds) =>
  seconds ? new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const usageSummary = (usedBy = []) => {
  if (!usedBy.length) return 'Not used';
  const first = `${usedBy[0].type}: ${usedBy[0].label}`;
  return usedBy.length > 1 ? `${first} +${usedBy.length - 1}` : first;
};

const errorMessage = (err, fallback) => err?.data?.detail || err?.message || fallback;

/**
 * Document library overlay used by every admin document field, the document
 * counterpart of MediaLibraryModal: browse and search uploaded documents (by
 * filename, folder, or the product/family/catalog using them), preview one,
 * upload new ones (button or drag & drop), and pick one.
 *
 * onSelect receives the chosen URL. `kinds` limits the library to those
 * document kinds (e.g. ['pdf']); `subfolder` is where new uploads go.
 * `selectedUrls` marks documents the field already has.
 */
const DocumentLibraryModal = ({
  isOpen,
  onClose,
  onSelect,
  subfolder = 'general',
  title,
  kinds,
  selectedUrls = [],
}) => {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [kind, setKind] = useState('');
  const [usedByType, setUsedByType] = useState('');
  const [types, setTypes] = useState([]);
  const [kindCounts, setKindCounts] = useState([]);
  const [usage, setUsage] = useState('all');
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);
  const requestSeq = useRef(0);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);

  const allowedKinds = useMemo(() => (kinds?.length ? kinds : null), [kinds]);
  const lockedKind = allowedKinds?.length === 1 ? allowedKinds[0] : '';
  const acceptAttr = useMemo(
    () => (allowedKinds || ['pdf', 'word', 'zip']).flatMap((k) => KIND_INFO[k]?.accept || []).join(','),
    [allowedKinds],
  );
  const acceptsFile = useCallback((file) => {
    if (!UPLOADABLE.test(file.name)) return false;
    if (!allowedKinds) return true;
    const ext = `.${extensionOf(file.name).toLowerCase()}`;
    return allowedKinds.some((k) => KIND_INFO[k]?.accept.includes(ext));
  }, [allowedKinds]);
  const uploadHint = (allowedKinds || ['pdf', 'word', 'zip']).map((k) => KIND_INFO[k]?.label).filter(Boolean).join(', ');

  useEffect(() => setMounted(true), []);

  // Fresh state each time the overlay opens
  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setDebouncedQuery('');
    setFolder('');
    setKind(lockedKind);
    setUsedByType('');
    setUsage('all');
    setSelected(null);
    setUploads([]);
    setPreview(null);
    setError(null);
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen, lockedKind]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (nextPage = 1) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listDocuments({ q: debouncedQuery, folder, kind, usage, usedByType, page: nextPage, pageSize: PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setFolders(res.folders || []);
      setTypes(res.types || []);
      setKindCounts(res.kinds || []);
      setTotal(res.total || 0);
      setPage(nextPage);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(errorMessage(err, 'Could not load documents'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [debouncedQuery, folder, kind, usage, usedByType]);

  useEffect(() => {
    // Wait for the open-reset to apply the locked kind before the first fetch
    if (isOpen && (!lockedKind || kind === lockedKind)) load(1);
  }, [isOpen, load, lockedKind, kind]);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Capture phase so Escape closes only the top layer, not an editor modal underneath
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (preview) setPreview(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, preview]);

  const alreadyAdded = useMemo(() => new Set(selectedUrls.filter(Boolean)), [selectedUrls]);
  const detail = useMemo(
    () => (selected ? items.find((i) => i.url === selected) || { url: selected, filename: selected.split('/').pop(), used_by: [] } : null),
    [selected, items],
  );

  const commit = (url) => {
    if (!url) return;
    onSelect(url);
    onClose();
  };

  const handleFiles = async (fileList) => {
    const all = Array.from(fileList || []);
    const file = all.find(acceptsFile);
    if (!file) {
      if (all.length) setError(`Only ${uploadHint} files can be uploaded here.`);
      return;
    }
    const id = `${file.name}-${file.size}-${Math.random()}`;
    setUploads((prev) => [{ id, name: file.name, status: 'uploading' }, ...prev]);
    try {
      const url = await uploadDocument(file, subfolder);
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'done' } : u)));
      setSelected(url);
      // Show the new file: uploads list first, newest first
      setQuery('');
      setDebouncedQuery('');
      setUsage('all');
      setUsedByType('');
      if (folder !== '') setFolder('');
      else load(1);
    } catch (err) {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'error', error: errorMessage(err, 'Upload failed') } : u)));
    }
  };

  const handleDelete = async () => {
    if (!detail || detail.used_by?.length) return;
    if (!window.confirm(`Permanently delete ${detail.filename || 'this document'}?`)) return;
    setDeleting(true);
    try {
      await deleteDocument(detail.url);
      setSelected(null);
      setItems((prev) => prev.filter((i) => i.url !== detail.url));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete document'));
    } finally {
      setDeleting(false);
    }
  };

  const onDragEnter = (e) => {
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
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
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer?.files);
  };

  if (!isOpen || !mounted) return null;

  const activeUploads = uploads.filter((u) => u.status === 'uploading').length;
  const failedUploads = uploads.filter((u) => u.status === 'error');
  const canDelete = detail && detail.on_disk && !detail.used_by?.length && !alreadyAdded.has(detail.url);
  const filtered = folder || usedByType || usage !== 'all' || (kind && !lockedKind);
  const kindOptions = kindCounts.filter((k) => !allowedKinds || allowedKinds.includes(k.name));

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-stretch justify-center bg-black/75 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Document library'}
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-dark-700 shadow-2xl sm:h-[min(860px,calc(100dvh-2rem))] sm:rounded-xl sm:border sm:border-dark-500"
        onMouseDown={(e) => e.stopPropagation()}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-dark-500 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-dark-50">{title || 'Choose a document'}</h2>
            <p className="text-xs text-dark-300">
              Pick an existing document or upload a new one. New uploads go to <span className="font-medium text-dark-100">{subfolder}</span>.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-medium text-white transition-colors hover:bg-primary-500"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload new</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-200 transition-colors hover:bg-dark-600 hover:text-dark-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 border-b border-dark-600 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <label className="relative flex-1">
            <span className="sr-only">Search documents</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-300" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Search by filename, family, catalog, model number…"
              className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2 pl-9 pr-3 text-sm text-dark-50 placeholder:text-dark-300 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {!lockedKind && (
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                aria-label="File type"
                className="min-w-0 flex-1 rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none sm:flex-none"
              >
                <option value="">All file types</option>
                {kindOptions.map((k) => (
                  <option key={k.name} value={k.name}>
                    {KIND_INFO[k.name]?.label || k.name} ({k.count})
                  </option>
                ))}
              </select>
            )}
            <select
              value={usedByType}
              onChange={(e) => setUsedByType(e.target.value)}
              aria-label="Used by"
              className="min-w-0 flex-1 rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none sm:flex-none"
            >
              <option value="">Used by anything</option>
              {types.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </option>
              ))}
            </select>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              aria-label="Folder"
              className="min-w-0 flex-1 rounded-lg border border-dark-500 bg-dark-800 px-3 py-2 text-sm text-dark-50 focus:border-primary-500 focus:outline-none sm:flex-none"
            >
              <option value="">All folders</option>
              {folders.map((f) => (
                <option key={f.name || '(root)'} value={f.name}>
                  {f.name || '(root)'} ({f.count})
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border border-dark-500 bg-dark-800 p-0.5" role="group" aria-label="Usage">
              {USAGE_FILTERS.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUsage(u.value)}
                  aria-pressed={usage === u.value}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    usage === u.value ? 'bg-dark-500 text-dark-50' : 'text-dark-300 hover:text-dark-100'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload status */}
        {(activeUploads > 0 || failedUploads.length > 0) && (
          <div className="space-y-1 border-b border-dark-600 bg-dark-800/60 px-4 py-2 text-xs sm:px-5" aria-live="polite">
            {uploads.filter((u) => u.status === 'uploading').map((u) => (
              <p key={u.id} className="flex items-center gap-2 text-dark-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading {u.name}…
              </p>
            ))}
            {failedUploads.map((u) => (
              <p key={u.id} className="text-red-300">
                {u.name}: {u.error}
              </p>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {error && <p className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</p>}

          {!loading && items.length === 0 && !error ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-10 w-10 text-dark-400" />
              <p className="text-sm text-dark-200">
                {debouncedQuery
                  ? `No documents match “${debouncedQuery}”`
                  : filtered ? 'No documents match these filters.' : 'No documents yet.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {filtered && (
                  <button
                    type="button"
                    onClick={() => {
                      setFolder('');
                      setUsedByType('');
                      setUsage('all');
                      setKind(lockedKind);
                    }}
                    className="rounded-lg bg-dark-600 px-3 py-2 text-sm text-dark-50 hover:bg-dark-500"
                  >
                    Clear filters
                  </button>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500">
                  Upload a document
                </button>
              </div>
              <p className="text-xs text-dark-300">Or drop a {uploadHint} file anywhere in this window.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item) => {
                const isSelected = selected === item.url;
                const added = alreadyAdded.has(item.url);
                const Icon = KIND_INFO[item.kind]?.icon || File;
                return (
                  <li key={item.url}>
                    <button
                      type="button"
                      onClick={() => setSelected(isSelected ? null : item.url)}
                      onDoubleClick={() => commit(item.url)}
                      aria-pressed={isSelected}
                      title={`${item.filename}\n${item.used_by.map((u) => `${u.type}: ${u.label}`).join('\n') || 'Not used'}`}
                      className={`group block w-full overflow-hidden rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        isSelected ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-500 hover:border-dark-300'
                      }`}
                    >
                      <div className="relative flex aspect-[3/4] items-center justify-center bg-dark-900">
                        {item.cover_url ? (
                          <img
                            src={resolveImageUrl(item.cover_url)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-2 text-dark-300">
                            <Icon className="h-10 w-10" />
                            <span className="rounded bg-dark-700 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-dark-100">
                              {extensionOf(item.filename) || 'FILE'}
                            </span>
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        {added && !isSelected && (
                          <span className="absolute left-1.5 top-1.5 rounded bg-dark-950/85 px-1.5 py-0.5 text-[10px] font-medium text-dark-100">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5 bg-dark-800 px-2 py-1.5">
                        <p className="truncate text-xs font-medium text-dark-50">{item.filename}</p>
                        <p className={`truncate text-[11px] ${item.used_by.length ? 'text-dark-200' : 'text-dark-400'}`}>
                          {usageSummary(item.used_by)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-dark-200">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading documents…
            </div>
          )}
          {!loading && items.length < total && (
            <div className="flex justify-center py-4">
              <button type="button" onClick={() => load(page + 1)} className="rounded-lg bg-dark-600 px-4 py-2 text-sm text-dark-50 hover:bg-dark-500">
                Load more ({total - items.length} more)
              </button>
            </div>
          )}

          {dragging && (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary-500 bg-dark-900/85">
              <p className="flex items-center gap-2 text-sm font-medium text-dark-50">
                <Upload className="h-5 w-5" /> Drop to upload to {subfolder}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-dark-500 bg-dark-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 text-xs text-dark-200">
            {detail ? (
              <div className="min-w-0">
                <p className="truncate font-medium text-dark-50">{detail.filename || detail.url}</p>
                <p className="truncate">
                  {[
                    detail.folder,
                    formatSize(detail.size || null),
                    formatDate(detail.modified),
                    detail.on_disk === false && 'linked from outside the uploads folder',
                  ].filter(Boolean).join(' · ')}
                </p>
                <p className="truncate" title={detail.used_by?.map((u) => `${u.type}: ${u.label}`).join('\n')}>
                  {detail.used_by?.length
                    ? `Used by ${detail.used_by.map((u) => `${u.type} ${u.label}`).join(', ')}`
                    : 'Not used anywhere yet'}
                </p>
              </div>
            ) : (
              <p>{total} document{total === 1 ? '' : 's'} · double-click to use</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {detail && (
              <button
                type="button"
                onClick={() => setPreview(detail)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-dark-100 transition-colors hover:bg-dark-600"
              >
                <Eye className="h-4 w-4" /> Preview
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/30 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button type="button" onClick={onClose} className="min-h-[40px] rounded-lg px-4 text-sm font-medium text-dark-100 transition-colors hover:bg-dark-600">
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || activeUploads > 0}
              onClick={() => commit(selected)}
              className="min-h-[40px] rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use document
            </button>
          </div>
        </div>

        {/* Inside the dialog so the viewer's clicks don't bubble (through the portal) to the backdrop */}
        <PDFViewerModal
          isOpen={!!preview}
          onClose={() => setPreview(null)}
          fileUrl={preview?.url}
          fileName={preview?.filename}
          fileType={KIND_INFO[preview?.kind]?.label || extensionOf(preview?.filename) || 'PDF'}
          layerClassName="z-[10060]"
        />
      </div>
    </div>,
    document.body,
  );
};

export default DocumentLibraryModal;
