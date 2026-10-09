import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Image as ImageIcon, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { uploadImage } from '../../../utils/imageUpload';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { deleteMediaImage, listMediaImages } from '../../../services/mediaLibraryService';

const PAGE_SIZE = 60;

const USAGE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'used', label: 'In use' },
  { value: 'unused', label: 'Unused' },
];

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
 * Media library overlay used by every admin image field: browse and search
 * uploaded images (by filename, folder, or the product/record using them),
 * upload new ones (button or drag & drop), and pick one or several.
 *
 * onSelect receives a URL string, or an array of URLs when `multiple`.
 * The library holds every uploaded file plus every image any record uses,
 * wherever it is stored. `subfolder` is where new uploads go.
 * `selectedUrls` marks images the field already has.
 */
const MediaLibraryModal = ({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  subfolder = 'general',
  title,
  selectedUrls = [],
}) => {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [usedByType, setUsedByType] = useState('');
  const [types, setTypes] = useState([]);
  const [usage, setUsage] = useState('all');
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const requestSeq = useRef(0);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);

  useEffect(() => setMounted(true), []);

  // Fresh state each time the overlay opens
  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setDebouncedQuery('');
    setFolder('');
    setUsedByType('');
    setUsage('all');
    setSelected([]);
    setUploads([]);
    setError(null);
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (nextPage = 1) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listMediaImages({ q: debouncedQuery, folder, usage, usedByType, page: nextPage, pageSize: PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setFolders(res.folders || []);
      setTypes(res.types || []);
      setTotal(res.total || 0);
      setPage(nextPage);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(errorMessage(err, 'Could not load images'));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [debouncedQuery, folder, usage, usedByType]);

  useEffect(() => {
    if (isOpen) load(1);
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Capture phase so Escape closes only this overlay, not an editor modal underneath
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const alreadyAdded = useMemo(() => new Set(selectedUrls.filter(Boolean)), [selectedUrls]);
  const selectedItems = useMemo(
    () => selected.map((url) => items.find((i) => i.url === url) || { url, used_by: [] }),
    [selected, items],
  );

  const commit = (urls) => {
    if (!urls.length) return;
    onSelect(multiple ? urls : urls[0]);
    onClose();
  };

  const toggle = (url) => {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      return multiple ? [...prev, url] : [url];
    });
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const toUpload = multiple ? files : files.slice(0, 1);
    const batch = toUpload.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, name: file.name, status: 'uploading' }));
    setUploads((prev) => [...batch, ...prev]);

    const uploaded = [];
    await Promise.all(toUpload.map(async (file, idx) => {
      const { id } = batch[idx];
      try {
        const url = await uploadImage(file, subfolder);
        uploaded[idx] = url;
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'done' } : u)));
      } catch (err) {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'error', error: errorMessage(err, 'Upload failed') } : u)));
      }
    }));
    const urls = uploaded.filter(Boolean);
    if (!urls.length) return;

    setSelected((prev) => (multiple ? [...prev, ...urls.filter((u) => !prev.includes(u))] : [urls[0]]));
    // Show the new files: uploads list first, newest first
    setQuery('');
    setDebouncedQuery('');
    setUsage('all');
    setUsedByType('');
    if (folder !== '') setFolder('');
    else load(1);
  };

  const handleDelete = async () => {
    const target = selectedItems[0];
    if (!target || target.used_by?.length) return;
    if (!window.confirm(`Permanently delete ${target.filename || 'this image'}?`)) return;
    setDeleting(true);
    try {
      await deleteMediaImage(target.url);
      setSelected([]);
      setItems((prev) => prev.filter((i) => i.url !== target.url));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete image'));
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
  const detail = selectedItems.length === 1 ? selectedItems[0] : null;
  const canDelete = detail && detail.on_disk && !detail.used_by?.length && !alreadyAdded.has(detail.url);
  const filtered = folder || usedByType || usage !== 'all';
  const confirmLabel = multiple
    ? `Add ${selected.length > 1 ? `${selected.length} images` : 'image'}`
    : 'Use image';

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-stretch justify-center bg-black/75 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Media library'}
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
            <h2 className="truncate text-lg font-semibold text-dark-50">{title || (multiple ? 'Add images' : 'Choose an image')}</h2>
            <p className="text-xs text-dark-300">
              Pick an existing image or upload a new one. New uploads go to <span className="font-medium text-dark-100">{subfolder}</span>.
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
              accept="image/*"
              multiple={multiple}
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
            <span className="sr-only">Search images</span>
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
              placeholder="Search by filename, product name, model number…"
              className="w-full rounded-lg border border-dark-500 bg-dark-800 py-2 pl-9 pr-3 text-sm text-dark-50 placeholder:text-dark-300 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
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
            {activeUploads > 0 && (
              <p className="flex items-center gap-2 text-dark-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading {activeUploads} image{activeUploads === 1 ? '' : 's'}…
              </p>
            )}
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
              <ImageIcon className="h-10 w-10 text-dark-400" />
              <p className="text-sm text-dark-200">
                {debouncedQuery
                  ? `No images match “${debouncedQuery}”`
                  : filtered ? 'No images match these filters.' : 'No images yet.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {filtered && (
                  <button
                    type="button"
                    onClick={() => {
                      setFolder('');
                      setUsedByType('');
                      setUsage('all');
                    }}
                    className="rounded-lg bg-dark-600 px-3 py-2 text-sm text-dark-50 hover:bg-dark-500"
                  >
                    Clear filters
                  </button>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500">
                  Upload an image
                </button>
              </div>
              <p className="text-xs text-dark-300">Or drop image files anywhere in this window.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item) => {
                const isSelected = selected.includes(item.url);
                const order = multiple && isSelected ? selected.indexOf(item.url) + 1 : null;
                const added = alreadyAdded.has(item.url);
                return (
                  <li key={item.url}>
                    <button
                      type="button"
                      onClick={() => toggle(item.url)}
                      onDoubleClick={() => !multiple && commit([item.url])}
                      aria-pressed={isSelected}
                      title={`${item.filename}\n${item.used_by.map((u) => `${u.type}: ${u.label}`).join('\n') || 'Not used'}`}
                      className={`group block w-full overflow-hidden rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        isSelected ? 'border-primary-500 ring-2 ring-primary-500' : 'border-dark-500 hover:border-dark-300'
                      }`}
                    >
                      <div className="relative aspect-square bg-dark-900 bg-[length:16px_16px] bg-[linear-gradient(45deg,#1f1f1f_25%,transparent_25%),linear-gradient(-45deg,#1f1f1f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f1f_75%),linear-gradient(-45deg,transparent_75%,#1f1f1f_75%)]">
                        <img
                          src={resolveImageUrl(item.thumbnail_url)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            // Older uploads may have no renditions: fall back to the original
                            const fallback = resolveImageUrl(item.url);
                            if (!e.currentTarget.dataset.fellBack) {
                              e.currentTarget.dataset.fellBack = '1';
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                        {isSelected && (
                          <span className="absolute right-1.5 top-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-500 px-1 text-xs font-semibold text-white">
                            {order || <Check className="h-4 w-4" />}
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading images…
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
            ) : selected.length > 1 ? (
              <p>{selected.length} images selected</p>
            ) : (
              <p>{total} image{total === 1 ? '' : 's'}{multiple ? ' · click to select several' : ' · double-click to use'}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              disabled={!selected.length || activeUploads > 0}
              onClick={() => commit(selected)}
              className="min-h-[40px] rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MediaLibraryModal;
