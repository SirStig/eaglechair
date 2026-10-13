import { useMemo, useState } from 'react';
import { X, Loader2, ChevronLeft, ChevronUp, Search, Trash2, Check } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { bulkEdit } from '../../../services/bulkService';
import FloatingDock from './FloatingDock';
import FitLabel from './FitLabel';
import PermanentDeleteModal from '../PermanentDeleteModal';
import { deletePermanently } from './permanentDelete';
import { PERMISSIONS, useAdminPermissions } from '../../../hooks/useAdminPermissions';

const pluralize = (noun) => {
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
};

const ACTION_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-2';
const OPTION_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2';
const TILE =
  'flex h-11 min-w-0 items-center gap-1 rounded-lg border px-2.5 text-left font-medium transition-colors disabled:opacity-60';
const TONES = {
  default: 'border-dark-600 bg-dark-700/60 text-dark-100 hover:border-primary-500/60 hover:bg-dark-700',
  danger: 'border-red-500/40 bg-red-950/20 text-red-300 hover:bg-red-900/30',
};
// Show a filter box once a pick list gets long
const SEARCH_AFTER = 8;

/**
 * Batch-edit bar pinned to the bottom of the window while rows are selected.
 *
 * actions: array of
 *   { label, changes, tone?, confirm? }               one-click change set
 *                                                      (confirm: ask first)
 *   { label, options: [{value, label}], toChanges }    pick a value, confirm, apply
 *   { label, options, multiple: true, toChanges }      tick several values; toChanges
 *                                                      gets the array of values
 *   { label, input: {type, placeholder, step}, toChanges }  type a value, apply
 *   { label, run: async (ids, value) => {...}, tone? } custom handler; may also
 *                                                      take options or input;
 *                                                      return false to cancel
 *   { label, onClick: (ids) => {...}, tone? }          just call (e.g. open a
 *                                                      confirm dialog)
 *
 * Change sets go to POST /admin/bulk/{resource}; onDone runs afterwards so the
 * page can reload. `confirm={false}` skips the confirm step (local edits) and
 * `quiet` skips the success toast.
 *
 * permanentDelete: { isRetired: (id) => bool, resource?, retiredLabel? } adds a
 * "Delete permanently" action for the selected rows that are already
 * archived / deactivated (super admin, typed confirmation; the server skips
 * anything still active or in use and says why).
 *
 * Permissions (hooks/useAdminPermissions.js; the server enforces them too):
 * delete actions (label starting "Delete", or `requires: 'delete'`) need
 * "delete", the permanent delete needs "permanent_delete", and viewers with
 * no edit permission get no bar.
 */
export default function BulkActionBar({
  selection,
  resource,
  actions,
  onDone,
  noun = 'item',
  pluralNoun,
  confirm = true,
  quiet = false,
  permanentDelete = null,
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // null | { action, step: 'pick' | 'input' | 'confirm', value? }
  const [panel, setPanel] = useState(null);
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  // Ticked values while a `multiple` pick list is open
  const [picked, setPicked] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { can, permissions } = useAdminPermissions();

  const visibleOptions = useMemo(() => {
    const options = panel?.action.options || [];
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  }, [panel, query]);

  if (!selection.count || permissions.size === 0) return null;

  const isDeleteAction = (action) =>
    action.requires === PERMISSIONS.DELETE || (!action.changes && /^delete\b/i.test(action.label));
  const visibleActions = actions.filter(
    (action) => (!action.requires || can(action.requires)) && (can(PERMISSIONS.DELETE) || !isDeleteAction(action))
  );
  const allowPermanentDelete = permanentDelete && can(PERMISSIONS.PERMANENT_DELETE);

  const ids = selection.selectedIds;
  const nounFor = (n) => (n === 1 ? noun : pluralNoun || pluralize(noun));
  const plural = `${ids.length} ${nounFor(ids.length)}`;

  const close = () => {
    setPanel(null);
    setQuery('');
    setInputValue('');
    setPicked([]);
  };

  // From a multi-pick confirm, step back to the ticked list instead of closing
  const back = () =>
    panel?.step === 'confirm' && panel.action.multiple ? setPanel({ action: panel.action, step: 'pick' }) : close();

  const togglePicked = (value) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const apply = async (action, value) => {
    setBusy(true);
    try {
      if (action.run) {
        // A run handler returns false when the user backed out: keep the selection
        if ((await action.run(ids, value)) === false) return;
        if (!quiet) toast.success(`${action.label}: ${plural}`);
      } else {
        const changes = action.toChanges ? action.toChanges(value) : action.changes;
        const result = await bulkEdit(resource, ids, changes);
        const updated = result?.updated ?? ids.length;
        if (!quiet) toast.success(`Updated ${updated} ${nounFor(updated)}`);
        if (result?.note) toast.warning(result.note, 10000);
      }
      close();
      selection.clear();
      await onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Bulk edit failed');
    } finally {
      setBusy(false);
    }
  };

  const choose = (action, value) => {
    if (confirm) setPanel({ action, step: 'confirm', value });
    else apply(action, value);
  };

  const start = (action) => {
    if (action.onClick) return action.onClick(ids);
    if (action.options) return setPanel({ action, step: 'pick' });
    if (action.input) return setPanel({ action, step: 'input' });
    if (action.confirm && confirm) return setPanel({ action, step: 'confirm' });
    return apply(action);
  };

  const retiredIds = permanentDelete ? ids.filter((id) => permanentDelete.isRetired(id)) : [];
  const activeCount = ids.length - retiredIds.length;
  const confirmPermanentDelete = async () => {
    setDeleting(true);
    try {
      await deletePermanently(toast, permanentDelete.resource || resource, retiredIds, {
        noun,
        pluralNoun: pluralNoun || pluralize(noun),
      });
      setDeleteOpen(false);
      selection.clear();
      await onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Permanent delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const optionLabel = (action, value) =>
    action.options?.find((o) => String(o.value) === String(value))?.label ?? value;
  const valueLabel = (action, value) => {
    if (!Array.isArray(value)) return optionLabel(action, value);
    const labels = value.map((v) => optionLabel(action, v));
    return labels.length > 4 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more` : labels.join(', ');
  };
  const allVisiblePicked = visibleOptions.length > 0 && visibleOptions.every((o) => picked.includes(o.value));

  return (
    <FloatingDock label={`Batch edit ${pluralNoun || pluralize(noun)}`}>
      <div className="flex items-center gap-2 border-b border-dark-700 px-3 py-2">
        {panel ? (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-dark-200 hover:bg-dark-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : null}
        <span className="min-w-0 truncate text-sm font-semibold text-dark-50">
          {panel ? panel.action.label : `${plural} selected`}
        </span>
        {panel && <span className="hidden sm:inline text-sm text-dark-400">· {plural}</span>}
        {!panel && ids.length === 1 && (
          <span className="hidden md:inline text-xs text-dark-400">
            Shift-click another row&apos;s checkbox to select everything in between
          </span>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-primary-400" />}
        <button
          type="button"
          onClick={() => {
            close();
            selection.clear();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-dark-300 hover:bg-dark-700 hover:text-dark-50"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      <div className="max-h-[38vh] overflow-y-auto p-2.5">
        {!panel && (
          <div className={ACTION_GRID}>
            {visibleActions.map((action) => {
              const opensPanel = action.options || action.input;
              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={busy || (action.options && action.options.length === 0)}
                  onClick={() => start(action)}
                  className={`${TILE} ${TONES[action.tone] || TONES.default}`}
                  title={action.label}
                >
                  <FitLabel text={action.label} />
                  {opensPanel && <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
                </button>
              );
            })}
            {allowPermanentDelete && (
              <button
                type="button"
                disabled={busy || retiredIds.length === 0}
                onClick={() => setDeleteOpen(true)}
                className={`${TILE} ${TONES.danger} border-dashed`}
                title={
                  retiredIds.length
                    ? `Permanently delete ${retiredIds.length} ${nounFor(retiredIds.length)}`
                    : `Only ${permanentDelete.retiredLabel || 'archived or deactivated'} ${pluralNoun || pluralize(noun)} can be deleted permanently`
                }
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <FitLabel text={retiredIds.length ? `Delete permanently (${retiredIds.length})` : 'Delete permanently'} />
              </button>
            )}
          </div>
        )}

        {panel?.step === 'pick' && (
          <div className="space-y-2">
            {panel.action.options.length > SEARCH_AFTER && (
              <label className="flex items-center gap-2 rounded-lg border border-dark-600 bg-dark-700 px-2.5">
                <Search className="h-4 w-4 text-dark-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="w-full bg-transparent py-2 text-sm text-dark-50 outline-none"
                />
              </label>
            )}
            {panel.action.multiple && (
              <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setPicked((prev) =>
                      allVisiblePicked
                        ? prev.filter((v) => !visibleOptions.some((o) => o.value === v))
                        : [...new Set([...prev, ...visibleOptions.map((o) => o.value)])]
                    )
                  }
                  className="rounded-lg px-2 py-1 text-dark-200 hover:bg-dark-700"
                >
                  {allVisiblePicked ? 'Unselect shown' : `Select all shown (${visibleOptions.length})`}
                </button>
                <span className="text-dark-400">{picked.length} picked</span>
                <button
                  type="button"
                  disabled={busy || picked.length === 0}
                  onClick={() => choose(panel.action, picked)}
                  className="ml-auto rounded-lg bg-primary-600 px-4 py-1.5 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            )}
            <div className={OPTION_GRID}>
              {visibleOptions.map((o) => {
                const on = panel.action.multiple && picked.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={busy}
                    aria-pressed={panel.action.multiple ? on : undefined}
                    onClick={() => (panel.action.multiple ? togglePicked(o.value) : choose(panel.action, o.value))}
                    className={`${TILE} ${on ? 'border-primary-500 bg-primary-900/30 text-dark-50' : TONES.default}`}
                    title={o.label}
                  >
                    {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary-300" aria-hidden="true" />}
                    <FitLabel text={String(o.label)} />
                  </button>
                );
              })}
              {visibleOptions.length === 0 && <p className="px-1 py-2 text-sm text-dark-400">No matches</p>}
            </div>
          </div>
        )}

        {panel?.step === 'input' && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (inputValue === '') return;
              choose(panel.action, inputValue);
            }}
          >
            <input
              autoFocus
              type={panel.action.input.type || 'text'}
              step={panel.action.input.step}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={panel.action.input.placeholder}
              className="min-w-0 flex-1 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-dark-50 outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={busy || inputValue === ''}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              Set
            </button>
          </form>
        )}

        {panel?.step === 'confirm' && (
          <div className="flex flex-wrap items-center gap-3 px-1 py-1 text-sm text-dark-100">
            <span className="min-w-0 flex-1">
              {panel.value === undefined ? (
                <strong className="text-dark-50">{panel.action.label}</strong>
              ) : (
                <>
                  {panel.action.label}: <strong className="text-dark-50">{valueLabel(panel.action, panel.value)}</strong>
                </>
              )}{' '}
              for {plural}?
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => apply(panel.action, panel.value)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {panel.action.tone === 'danger' && panel.value === undefined ? panel.action.label : 'Apply'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={back}
              className="rounded-lg px-3 py-2 text-dark-300 hover:bg-dark-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {allowPermanentDelete && (
        <PermanentDeleteModal
          isOpen={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          onConfirm={confirmPermanentDelete}
          isLoading={deleting}
          count={retiredIds.length}
          itemLabel={noun}
          title={`Permanently delete ${retiredIds.length} ${nounFor(retiredIds.length)}?`}
          message={
            <>
              {retiredIds.length} {permanentDelete.retiredLabel || 'archived / deactivated'} {nounFor(retiredIds.length)} will be
              removed from the database, along with their own data (variations, images, links).
              {activeCount > 0 && ` ${activeCount} selected ${activeCount === 1 ? 'is' : 'are'} still active and will be kept.`}
              {' '}Anything still used elsewhere, such as a product on a quote, is kept and listed afterwards.
            </>
          }
        />
      )}
    </FloatingDock>
  );
}
