import { useMemo, useState } from 'react';
import { X, Loader2, ChevronLeft, ChevronUp, Search } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { bulkEdit } from '../../../services/bulkService';
import FloatingDock from './FloatingDock';
import FitLabel from './FitLabel';

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
 *   { label, changes, tone? }                         one-click change set
 *   { label, options: [{value, label}], toChanges }    pick a value, confirm, apply
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
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // null | { action, step: 'pick' | 'input' | 'confirm', value? }
  const [panel, setPanel] = useState(null);
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');

  const visibleOptions = useMemo(() => {
    const options = panel?.action.options || [];
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  }, [panel, query]);

  if (!selection.count) return null;

  const ids = selection.selectedIds;
  const nounFor = (n) => (n === 1 ? noun : pluralNoun || pluralize(noun));
  const plural = `${ids.length} ${nounFor(ids.length)}`;

  const close = () => {
    setPanel(null);
    setQuery('');
    setInputValue('');
  };

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
    return apply(action);
  };

  const valueLabel = (action, value) =>
    action.options?.find((o) => String(o.value) === String(value))?.label ?? value;

  return (
    <FloatingDock label={`Batch edit ${pluralNoun || pluralize(noun)}`}>
      <div className="flex items-center gap-2 border-b border-dark-700 px-3 py-2">
        {panel ? (
          <button
            type="button"
            onClick={close}
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
            {actions.map((action) => {
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
            <div className={OPTION_GRID}>
              {visibleOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(panel.action, o.value)}
                  className={`${TILE} ${TONES.default}`}
                  title={o.label}
                >
                  <FitLabel text={String(o.label)} />
                </button>
              ))}
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
              {panel.action.label}: <strong className="text-dark-50">{valueLabel(panel.action, panel.value)}</strong>{' '}
              for {plural}?
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => apply(panel.action, panel.value)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="rounded-lg px-3 py-2 text-dark-300 hover:bg-dark-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </FloatingDock>
  );
}
