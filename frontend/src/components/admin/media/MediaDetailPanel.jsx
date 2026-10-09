import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ClipboardCopy, Download, ExternalLink, FileText, History, Loader2, Pencil, Replace,
  RotateCcw, Trash2, Unlink, X,
} from 'lucide-react';
import { resolveFileUrl, resolveImageUrl } from '../../../utils/apiHelpers';
import {
  deleteMediaFiles, deleteMediaVersion, detachMedia, getMediaDetails, replaceMedia, restoreMediaVersion,
} from '../../../services/mediaManagerService';
import { errorMessage, formatDate, formatSize, isEditableImage } from './mediaFormat';
import { fieldLabel, recordLink } from './recordLinks';

const fileUrl = (kind, url) => (kind === 'image' ? resolveImageUrl(url) : resolveFileUrl(url));

function Confirm({ title, children, confirmLabel, danger = true, busy, disabled, onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-dark-500 bg-dark-700 p-5 shadow-2xl" role="alertdialog" aria-label={title}>
        <h3 className="text-base font-semibold text-dark-50">{title}</h3>
        <div className="mt-2 space-y-2 text-sm text-dark-200">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg px-4 py-2 text-sm text-dark-100 hover:bg-dark-600">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || disabled}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${danger ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-primary-500 text-dark-900 hover:bg-primary-400'}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageRow({ usage, action }) {
  const link = recordLink(usage);
  const label = (
    <>
      <span className="mr-1.5 rounded bg-dark-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dark-200">{usage.type}</span>
      <span className="text-dark-50">{usage.label}</span>
    </>
  );
  return (
    <li className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1 text-sm">
        {link ? (
          link.external ? (
            <a href={link.href} target="_blank" rel="noreferrer" className="hover:underline">{label} <ExternalLink className="inline h-3 w-3 text-dark-300" /></a>
          ) : (
            <Link to={link.href} className="hover:underline">{label}</Link>
          )
        ) : label}
        {usage.fields?.length > 0 && <p className="mt-0.5 text-[11px] text-dark-300">{usage.fields.map(fieldLabel).join(', ')}</p>}
      </div>
      {action}
    </li>
  );
}

/**
 * Side panel for one library file: preview, facts, where it's used (with
 * per-record "remove"), versions (restore / delete), replace, edit, delete.
 *
 * onChanged({ type, url, newUrl }) after anything changed, so the list can
 * refresh; type is replaced | restored | detached | deleted | version-deleted.
 */
export default function MediaDetailPanel({ kind, url, onClose, onChanged, onEdit, canEdit, canDelete, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [detachToo, setDetachToo] = useState(false);
  const replaceInput = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getMediaDetails(kind, url);
      if (mine === seq.current) setData(res);
    } catch (err) {
      if (mine === seq.current) setError(errorMessage(err, 'Could not load this file'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [kind, url]);

  useEffect(() => {
    setData(null);
    setConfirm(null);
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[aria-label="Image editor"]')) return;
      if (confirm) setConfirm(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, onClose]);

  const act = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err, 'That didn’t work'));
    } finally {
      setBusy(null);
    }
  };

  const recordCount = (n) => `${n} record${n === 1 ? '' : 's'}`;

  const onReplaceFile = (file) => act('replace', async () => {
    const res = await replaceMedia(kind, data.url, file);
    toast.success(`Replaced. ${res.updated?.length ? `${recordCount(res.updated.length)} now use the new file.` : 'Nothing was using it yet.'}`);
    onChanged({ type: 'replaced', url: data.url, newUrl: res.url });
  });

  const detachOne = (usage) => act(`detach-${usage.model}-${usage.id}`, async () => {
    await detachMedia(kind, data.url, [{ model: usage.model, id: usage.id }]);
    toast.success(`Removed from ${usage.type} ${usage.label}`);
    await load();
    onChanged({ type: 'detached', url: data.url });
  });

  const detachAll = () => act('detach-all', async () => {
    const res = await detachMedia(kind, data.url, null);
    toast.success(`Removed from ${recordCount(res.updated?.length || 0)}`);
    setConfirm(null);
    await load();
    onChanged({ type: 'detached', url: data.url });
  });

  const restore = (version) => act(`restore-${version.id}`, async () => {
    const res = await restoreMediaVersion(version.id);
    toast.success('Version restored');
    onChanged({ type: 'restored', url: data.url, newUrl: res.url });
  });

  const removeVersion = (version) => act(`version-${version.id}`, async () => {
    await deleteMediaVersion(version.id);
    setConfirm(null);
    await load();
    onChanged({ type: 'version-deleted', url: data.url });
  });

  const removeFile = () => act('delete', async () => {
    const res = await deleteMediaFiles(kind, [data.url], { detach: detachToo });
    if (res.failed?.length) throw new Error(res.failed[0].detail);
    toast.success('Deleted');
    setConfirm(null);
    onChanged({ type: 'deleted', url: data.url });
  });

  const used = data?.used_by || [];
  const mentions = data?.mentions || [];
  const versions = data?.versions || [];
  const editable = kind === 'image' && data?.on_disk && isEditableImage(data?.url);
  const preview = data && (kind === 'image'
    ? resolveImageUrl(data.renditions?.sizes?.[2]?.url || data.url)
    : null);

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex justify-end bg-black/50" onMouseDown={onClose}>
      <aside
        className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-dark-500 bg-dark-700 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="File details"
      >
        <header className="flex items-center gap-3 border-b border-dark-500 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-dark-50">{data?.filename || url.split('/').pop()}</h2>
            <p className="truncate text-xs text-dark-300">{data?.folder || (data && !data.on_disk ? 'Linked from outside the uploads folder' : '')}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-dark-200 hover:bg-dark-600 hover:text-dark-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !data && (
            <div className="flex items-center justify-center py-16 text-sm text-dark-200"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
          )}
          {error && <p className="m-4 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</p>}

          {data && (
            <>
              {/* Preview */}
              <div className="flex items-center justify-center bg-dark-900 bg-[length:16px_16px] bg-[linear-gradient(45deg,#1f1f1f_25%,transparent_25%),linear-gradient(-45deg,#1f1f1f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f1f_75%),linear-gradient(-45deg,transparent_75%,#1f1f1f_75%)] p-4">
                {kind === 'image' ? (
                  <a href={fileUrl(kind, data.url)} target="_blank" rel="noreferrer" title="Open full size">
                    <img src={preview} alt="" className="max-h-[42vh] w-auto max-w-full object-contain" onError={(e) => {
                      if (!e.currentTarget.dataset.fellBack) {
                        e.currentTarget.dataset.fellBack = '1';
                        e.currentTarget.src = resolveImageUrl(data.url);
                      }
                    }} />
                  </a>
                ) : (
                  <a href={fileUrl(kind, data.url)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 py-6 text-dark-100 hover:text-primary-300">
                    <FileText className="h-16 w-16" />
                    <span className="text-sm">Open document</span>
                  </a>
                )}
              </div>

              {data.version_of && (
                <div className="mx-4 mt-4 flex gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>This is an earlier version of <span className="font-medium">{data.version_of.split('/').pop()}</span> that some records still use.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 px-4 py-4">
                {editable && canEdit && (
                  <button type="button" onClick={() => onEdit(data)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary-500 px-3 text-sm font-semibold text-dark-900 hover:bg-primary-400">
                    <Pencil className="h-4 w-4" /> Edit image
                  </button>
                )}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => replaceInput.current?.click()} disabled={Boolean(busy)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-dark-600 px-3 text-sm font-medium text-dark-50 hover:bg-dark-500 disabled:opacity-50">
                      {busy === 'replace' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Replace className="h-4 w-4" />} Upload replacement
                    </button>
                    <input
                      ref={replaceInput}
                      type="file"
                      className="sr-only"
                      tabIndex={-1}
                      accept={kind === 'image' ? 'image/*' : '.pdf,.doc,.docx,.zip'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) onReplaceFile(file);
                      }}
                    />
                  </>
                )}
                {data.on_disk && (
                  <a href={fileUrl(kind, data.url)} download={data.filename} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-dark-600 px-3 text-sm font-medium text-dark-50 hover:bg-dark-500">
                    <Download className="h-4 w-4" /> Download
                  </a>
                )}
                {canDelete && (data.on_disk || used.length > 0) && (
                  <button type="button" onClick={() => { setDetachToo(false); setConfirm({ type: 'delete' }); }} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-900/30">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </div>

              {/* Facts */}
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 border-t border-dark-600 px-4 py-4 text-sm">
                {data.info && (
                  <>
                    <dt className="text-dark-300">Dimensions</dt>
                    <dd className="text-dark-50">{data.info.width} × {data.info.height} px{data.info.has_alpha ? ' · transparent' : ''}</dd>
                    <dt className="text-dark-300">Format</dt>
                    <dd className="text-dark-50">{data.info.format}{data.info.frames > 1 ? ` · ${data.info.frames} frames` : ''}</dd>
                  </>
                )}
                {data.on_disk && (
                  <>
                    <dt className="text-dark-300">Size</dt>
                    <dd className="text-dark-50">{formatSize(data.size)}</dd>
                    <dt className="text-dark-300">Uploaded</dt>
                    <dd className="text-dark-50">{formatDate(data.modified, true)}</dd>
                  </>
                )}
                <dt className="text-dark-300">URL</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-dark-100" title={data.url}>{data.url}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(data.url).then(() => toast.success('URL copied'))}
                    className="shrink-0 rounded p-1 text-dark-300 hover:bg-dark-600 hover:text-dark-50"
                    aria-label="Copy URL"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </dl>

              {/* Used by */}
              <section className="border-t border-dark-600 px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-dark-50">Used by {used.length > 0 && <span className="text-dark-300">({used.length})</span>}</h3>
                  {canEdit && used.length > 1 && (
                    <button type="button" onClick={() => setConfirm({ type: 'detach-all' })} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-dark-200 hover:bg-dark-600 hover:text-dark-50">
                      <Unlink className="h-3.5 w-3.5" /> Remove from all
                    </button>
                  )}
                </div>
                {used.length === 0 ? (
                  <p className="mt-2 text-sm text-dark-300">Nothing uses this file.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-dark-600">
                    {used.map((u) => (
                      <UsageRow
                        key={`${u.model}-${u.id}`}
                        usage={u}
                        action={canEdit && (
                          <button
                            type="button"
                            onClick={() => detachOne(u)}
                            disabled={Boolean(busy)}
                            title={`Remove from ${u.type} ${u.label}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-dark-200 hover:bg-dark-600 hover:text-red-300 disabled:opacity-40"
                          >
                            {busy === `detach-${u.model}-${u.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />} Remove
                          </button>
                        )}
                      />
                    ))}
                  </ul>
                )}
                {mentions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-dark-500 bg-dark-800/60 px-3 py-2">
                    <p className="text-xs font-medium text-dark-100">Also appears inside the text of</p>
                    <ul className="divide-y divide-dark-600">
                      {mentions.map((m) => <UsageRow key={`m-${m.model}-${m.id}`} usage={m} />)}
                    </ul>
                    <p className="pb-1 text-[11px] text-dark-300">Replacing updates these too. To remove it, edit that text.</p>
                  </div>
                )}
              </section>

              {/* Versions */}
              <section className="border-t border-dark-600 px-4 py-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-dark-50">
                  <History className="h-4 w-4 text-dark-300" /> Version history
                </h3>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-center gap-3 rounded-lg border border-primary-600/40 bg-primary-500/5 p-2">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-dark-900">
                      {kind === 'image'
                        ? <img src={resolveImageUrl(data.thumbnail_url || data.url)} alt="" className="h-full w-full object-contain" />
                        : <FileText className="m-3 h-6 w-6 text-dark-300" />}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-medium text-dark-50">Current</p>
                      <p className="truncate text-dark-300">{data.filename}</p>
                    </div>
                  </li>
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 rounded-lg border border-dark-600 p-2">
                      <a href={fileUrl(kind, v.url)} target="_blank" rel="noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded bg-dark-900" title="Open this version">
                        {kind === 'image'
                          ? <img src={resolveImageUrl(v.thumbnail_url || v.url)} alt="" loading="lazy" className="h-full w-full object-contain" onError={(e) => {
                            if (!e.currentTarget.dataset.fellBack) {
                              e.currentTarget.dataset.fellBack = '1';
                              e.currentTarget.src = resolveImageUrl(v.url);
                            }
                          }} />
                          : <FileText className="m-3 h-6 w-6 text-dark-300" />}
                      </a>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="text-dark-50">
                          {formatDate(v.created_at, true)}
                          <span className="text-dark-300"> · {v.action === 'edited' ? 'edited' : v.action === 'restored' ? 'swapped by a restore' : 'replaced'}{v.admin ? ` by ${v.admin}` : ''}</span>
                        </p>
                        <p className="truncate text-dark-300">{v.filename}{v.on_disk ? ` · ${formatSize(v.size)}` : ' · file missing'}</p>
                      </div>
                      {canEdit && v.on_disk && (
                        <button type="button" onClick={() => restore(v)} disabled={Boolean(busy)} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-dark-100 hover:bg-dark-600 disabled:opacity-40" title="Make this the current version">
                          {busy === `restore-${v.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => setConfirm({ type: 'version', version: v })} disabled={Boolean(busy)} className="shrink-0 rounded-md p-1.5 text-dark-300 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-40" aria-label="Delete this version">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {versions.length === 0 && (
                  <p className="mt-2 text-xs text-dark-300">
                    Earlier versions show up here after you replace or edit the file, and you can restore any of them.
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        {confirm?.type === 'delete' && (
          <Confirm
            title={`Delete ${data.filename}?`}
            confirmLabel="Delete"
            busy={busy === 'delete'}
            disabled={used.length > 0 && !detachToo}
            onConfirm={removeFile}
            onCancel={() => setConfirm(null)}
          >
            <p>The file{versions.length ? ` and its ${versions.length} earlier version${versions.length === 1 ? '' : 's'}` : ''} will be removed from the server.</p>
            {used.length > 0 && (
              <label className="flex items-start gap-2 rounded-lg bg-dark-800 p-2 text-dark-100">
                <input type="checkbox" checked={detachToo} onChange={(e) => setDetachToo(e.target.checked)} className="mt-0.5 accent-red-500" />
                <span>Also remove it from the {recordCount(used.length)} using it</span>
              </label>
            )}
            {mentions.length > 0 && <p className="text-amber-300">It also appears inside page text, so it can’t be deleted until that text is edited.</p>}
          </Confirm>
        )}
        {confirm?.type === 'detach-all' && (
          <Confirm title="Remove from every record?" confirmLabel="Remove from all" busy={busy === 'detach-all'} onConfirm={detachAll} onCancel={() => setConfirm(null)}>
            <p>{recordCount(used.length)} will stop using this file. The file itself stays in the library.</p>
          </Confirm>
        )}
        {confirm?.type === 'version' && (
          <Confirm title="Delete this version?" confirmLabel="Delete version" busy={busy === `version-${confirm.version.id}`} onConfirm={() => removeVersion(confirm.version)} onCancel={() => setConfirm(null)}>
            <p>{confirm.version.filename} from {formatDate(confirm.version.created_at, true)} will be removed from the server and can’t be restored from here.</p>
          </Confirm>
        )}
      </aside>
    </div>,
    document.body,
  );
}
