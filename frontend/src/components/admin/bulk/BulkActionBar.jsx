import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { bulkEdit } from '../../../services/bulkService';

/**
 * Sticky bar shown while rows are selected in an admin list.
 *
 * actions: array of
 *   { label, changes, tone? }                     one-click change set
 *   { label, options: [{value, label}], toChanges } pick a value, then Apply
 *   { label, run: async (ids) => {...}, tone? }   custom handler (no bulk API)
 *
 * Change sets go to POST /admin/bulk/{resource}; onDone runs afterwards so
 * the page can reload.
 */
export default function BulkActionBar({ selection, resource, actions, onDone, noun = 'item' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { action, value }

  if (!selection.count) return null;

  const ids = selection.selectedIds;
  const plural = `${ids.length} ${noun}${ids.length === 1 ? '' : 's'}`;

  const apply = async (action, value) => {
    setBusy(true);
    try {
      if (action.run) {
        await action.run(ids);
        toast.success(`${action.label}: ${plural}`);
      } else {
        const changes = action.toChanges ? action.toChanges(value) : action.changes;
        const result = await bulkEdit(resource, ids, changes);
        const updated = result?.updated ?? ids.length;
        toast.success(`Updated ${updated} ${noun}${updated === 1 ? '' : 's'}`);
      }
      setPending(null);
      selection.clear();
      await onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Bulk edit failed');
    } finally {
      setBusy(false);
    }
  };

  const pendingLabel = pending
    ? pending.action.options.find((o) => String(o.value) === String(pending.value))?.label
    : null;

  return (
    <div className="sticky bottom-20 sm:bottom-4 z-30" role="region" aria-label="Bulk actions">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-primary-500/60 bg-dark-800/95 px-3 py-2.5 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={selection.clear}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-dark-50 hover:bg-dark-700"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
          {plural} selected
        </button>
        <span className="hidden sm:block h-5 w-px bg-dark-600" />

        {pending ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-dark-100">
            <span>
              {pending.action.label}: <strong className="text-dark-50">{pendingLabel}</strong> for {plural}?
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => apply(pending.action, pending.value)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPending(null)}
              className="rounded-lg px-3 py-1.5 text-dark-300 hover:bg-dark-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) =>
              action.options ? (
                <select
                  key={action.label}
                  value=""
                  disabled={busy || action.options.length === 0}
                  onChange={(e) => e.target.value !== '' && setPending({ action, value: e.target.value })}
                  className="rounded-lg border border-dark-600 bg-dark-700 px-2.5 py-1.5 text-sm text-dark-100 focus:border-primary-500 outline-none"
                  aria-label={action.label}
                >
                  <option value="">{action.label}…</option>
                  {action.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  disabled={busy}
                  onClick={() => apply(action)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                    action.tone === 'danger'
                      ? 'border-red-500/40 text-red-300 hover:bg-red-900/30'
                      : 'border-dark-600 text-dark-100 hover:bg-dark-700'
                  }`}
                >
                  {action.label}
                </button>
              )
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary-400" />}
          </div>
        )}
      </div>
    </div>
  );
}
