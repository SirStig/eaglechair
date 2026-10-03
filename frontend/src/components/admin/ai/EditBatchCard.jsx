/**
 * Review card for a batch of AI-proposed changes (one propose_changes call).
 * Each row shows a before -> after diff and can be applied or declined on its
 * own; the header applies / declines every pending row (or just the selected).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, Loader2, ExternalLink, Layers, ChevronDown, ChevronRight, AlertTriangle, Plus, Trash2, PenLine,
} from 'lucide-react';
import { useAIChat } from '../../../contexts/AIChatContext';

const COLLAPSED_ROWS = 6;
const CENTS_FIELDS = new Set(['base_price', 'msrp', 'price_adjustment', 'additional_cost', 'list_price', 'price_per_sheet']);

const ENTITY_LABELS = {
  product: 'Product',
  variation: 'Variation',
  family: 'Family',
  category: 'Category',
  subcategory: 'Subcategory',
  finish: 'Finish',
  upholstery: 'Upholstery',
  color: 'Color',
  laminate: 'Laminate',
  hardware: 'Hardware',
  custom_option: 'Custom option',
  catalog: 'Catalog',
  catalog_project: 'Catalog project',
  tag: 'Tag',
};

const ACTION_META = {
  update: { label: 'Edit', Icon: PenLine, className: 'text-chat-accent' },
  create: { label: 'Create', Icon: Plus, className: 'text-chat-status-success' },
  delete: { label: 'Delete', Icon: Trash2, className: 'text-red-400' },
};

function isCents(key) {
  return CENTS_FIELDS.has(key) || key.endsWith('_cost');
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (isCents(key) && typeof value === 'number') {
    const sign = key === 'price_adjustment' && value > 0 ? '+' : '';
    return `${sign}$${(value / 100).toFixed(2)}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function statusCounts(edits) {
  return edits.reduce((acc, e) => {
    const s = e.status || 'pending';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
}

function DiffTable({ edit }) {
  const before = edit.before || {};
  if (edit.action === 'delete') {
    const refs = before._referenced_by;
    return (
      <div className="mt-2 text-[13px] text-chat-muted">
        Permanently removes this {ENTITY_LABELS[edit.entity_type]?.toLowerCase() || 'record'}.
        {refs && (
          <span className="block mt-1 text-amber-400/90">
            Still referenced by {Object.entries(refs).map(([k, n]) => `${n} ${k.split('.')[0].replace(/_/g, ' ')}`).join(', ')}.
          </span>
        )}
      </div>
    );
  }
  const entries = Object.entries(edit.changes || {});
  if (!entries.length) return null;
  return (
    <dl className="mt-2 rounded-md border border-chat-line divide-y divide-chat-line text-[13px]">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-2.5 py-1.5">
          <dt className="text-chat-muted truncate">{formatKey(key)}</dt>
          <dd className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
            {edit.action === 'update' && (
              <>
                <span className="text-chat-faint line-through break-all">{formatValue(key, before[key])}</span>
                <span className="text-chat-faint" aria-hidden="true">→</span>
              </>
            )}
            <span className="text-chat-text font-medium break-all">{formatValue(key, value)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EditRow({ edit, selected, onToggle, busy, onApply, onDecline }) {
  const status = edit.status || 'pending';
  const pending = status === 'pending';
  const meta = ACTION_META[edit.action] || ACTION_META.update;
  const [open, setOpen] = useState(pending);

  return (
    <li className="px-3.5 py-2.5">
      <div className="flex items-start gap-2.5">
        {pending ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={busy}
            className="mt-1 h-3.5 w-3.5 rounded border-chat-line-strong bg-transparent"
            aria-label={`Select ${edit.entity_name}`}
          />
        ) : (
          <span className="mt-0.5 w-3.5 flex-shrink-0">
            {status === 'applied' && <Check className="w-3.5 h-3.5 text-chat-status-success" />}
            {status === 'declined' && <X className="w-3.5 h-3.5 text-chat-faint" />}
            {status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center gap-1.5 text-left"
            aria-expanded={open}
          >
            <meta.Icon className={`w-3 h-3 flex-shrink-0 ${meta.className}`} />
            <span className={`text-[11px] font-medium ${meta.className}`}>{meta.label}</span>
            <span className="text-[11px] text-chat-faint">{ENTITY_LABELS[edit.entity_type] || edit.entity_type}</span>
            <span className={`text-[13px] font-medium truncate ${pending ? 'text-chat-text' : 'text-chat-muted'}`}>
              {edit.entity_name}
            </span>
            {!pending && (
              <span className="ml-auto flex-shrink-0 text-[11px] text-chat-faint capitalize">{status}</span>
            )}
          </button>
          {open && (
            <>
              {edit.reason && <p className="mt-0.5 text-[13px] text-chat-muted">{edit.reason}</p>}
              <DiffTable edit={edit} />
            </>
          )}
          {edit.error && (
            <p className={`mt-1.5 text-xs ${edit.conflict ? 'text-amber-400' : 'text-red-400'}`}>{edit.error}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {edit.admin_url && (
            <Link
              to={edit.admin_url}
              className="p-1.5 rounded-md text-chat-faint hover:text-chat-text hover:bg-white/[0.04] transition-colors"
              title="Open in editor"
              aria-label="Open in editor"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {pending && (
            <>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="p-1.5 rounded-md text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                title="Decline"
                aria-label={`Decline change to ${edit.entity_name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onApply(!!edit.conflict)}
                disabled={busy}
                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-xs font-semibold bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:opacity-60"
                title={edit.conflict ? 'Overwrite the newer value' : 'Apply'}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {edit.conflict ? 'Overwrite' : 'Apply'}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export default function EditBatchCard({ batch }) {
  const { applyProposals, declineProposals, busyProposalIds } = useAIChat();
  const edits = useMemo(() => batch?.edits || [], [batch]);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(edits.length <= COLLAPSED_ROWS);
  const [error, setError] = useState(null);

  const pendingIds = edits.filter(e => (e.status || 'pending') === 'pending').map(e => e.id);
  const selectedPending = pendingIds.filter(id => selected.has(id));
  const targetIds = selectedPending.length ? selectedPending : pendingIds;
  const anyBusy = edits.some(e => busyProposalIds[e.id]);
  const counts = statusCounts(edits);
  const visible = expanded ? edits : edits.slice(0, COLLAPSED_ROWS);
  const allSelected = pendingIds.length > 0 && selectedPending.length === pendingIds.length;
  const scopeLabel = selectedPending.length ? `selected (${selectedPending.length})` : `all (${pendingIds.length})`;

  const run = async (fn, ids, opts) => {
    setError(null);
    try {
      await fn(ids, opts);
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    } catch (err) {
      setError(err?.message || 'Request failed');
    }
  };

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="my-1 rounded-lg border border-chat-line-strong bg-chat-surface overflow-hidden">
      <div className="px-3.5 pt-3 pb-2.5 border-b border-chat-line">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-chat-accent">
          <Layers className="w-3 h-3" />
          Proposed changes · {edits.length}
        </div>
        <p className="mt-1 text-sm font-medium text-chat-text">{batch?.title || 'Proposed changes'}</p>
        <p className="mt-0.5 text-xs text-chat-faint">
          {['pending', 'applied', 'declined', 'failed']
            .filter(s => counts[s])
            .map(s => `${counts[s]} ${s}`)
            .join(' · ')}
        </p>
      </div>

      {pendingIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-chat-line">
          <label className="inline-flex items-center gap-2 text-xs text-chat-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(pendingIds))}
              disabled={anyBusy}
              className="h-3.5 w-3.5 rounded border-chat-line-strong bg-transparent"
            />
            Select all pending
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => run(declineProposals, targetIds)}
              disabled={anyBusy}
              className="h-8 px-3 rounded-md text-[13px] font-medium text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Decline {scopeLabel}
            </button>
            <button
              type="button"
              onClick={() => run(applyProposals, targetIds)}
              disabled={anyBusy}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {anyBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Apply {scopeLabel}
            </button>
          </div>
        </div>
      )}

      {error && <p className="px-3.5 pt-2 text-xs text-red-400">{error}</p>}

      <ul className="divide-y divide-chat-line">
        {visible.map(edit => (
          <EditRow
            key={edit.id}
            edit={edit}
            selected={selected.has(edit.id)}
            onToggle={() => toggle(edit.id)}
            busy={!!busyProposalIds[edit.id]}
            onApply={(force) => run(applyProposals, [edit.id], { force })}
            onDecline={() => run(declineProposals, [edit.id])}
          />
        ))}
      </ul>

      {edits.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 px-3.5 py-2 border-t border-chat-line text-xs text-chat-muted hover:text-chat-text hover:bg-white/[0.03] transition-colors"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? 'Show fewer' : `Show all ${edits.length} changes`}
        </button>
      )}
    </div>
  );
}
