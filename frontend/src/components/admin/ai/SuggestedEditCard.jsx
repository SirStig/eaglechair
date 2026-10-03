import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, PenLine, Loader2, ExternalLink } from 'lucide-react';
import { applyEdit } from '../../../services/aiChatService';
import { useAIChat } from '../../../contexts/AIChatContext';

function formatChange(key, value) {
  if ((key === 'base_price' || key === 'msrp') && typeof value === 'number') {
    return `$${(value / 100).toFixed(2)}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function getEditKey(edit) {
  return `${edit.entity_type}:${edit.entity_id}`;
}

export default function SuggestedEditCard({ edit, onApplied, onDeclined }) {
  const { applyingEditKeys, beginApplyingEdit, endApplyingEdit } = useAIChat();
  const [localStatus, setLocalStatus] = useState(null);
  const [error, setError] = useState(null);
  const status = edit.status || localStatus || 'pending';
  const editKey = getEditKey(edit);
  // True while this edit is being applied elsewhere (e.g. via "Accept All").
  const lockedElsewhere = !!applyingEditKeys[editKey] && localStatus !== 'applying';

  const handleApprove = async () => {
    if (applyingEditKeys[editKey]) return; // already in flight (this card or Accept All)
    beginApplyingEdit(editKey);
    setLocalStatus('applying');
    setError(null);
    try {
      await applyEdit({
        entity_type: edit.entity_type,
        entity_id: edit.entity_id,
        changes: edit.changes,
      });
      setLocalStatus('applied');
      onApplied?.(edit);
    } catch (err) {
      setError(err?.message || 'Failed to apply');
      setLocalStatus(null);
    } finally {
      endApplyingEdit(editKey);
    }
  };

  const handleDecline = () => {
    setLocalStatus('declined');
    onDeclined?.(edit);
  };

  if (status === 'applied' || status === 'declined') {
    const applied = status === 'applied';
    return (
      <div className="my-1 flex items-center gap-2 rounded-lg border border-chat-line bg-chat-surface px-3 py-2 text-[13px]">
        {applied
          ? <Check className="w-3.5 h-3.5 text-chat-status-success flex-shrink-0" />
          : <X className="w-3.5 h-3.5 text-chat-faint flex-shrink-0" />}
        <span className="text-chat-muted truncate">
          {applied ? 'Applied' : 'Declined'} edit to <span className="text-chat-text">{edit.entity_name}</span>
        </span>
      </div>
    );
  }

  const changeEntries = Object.entries(edit.changes || {});
  const busy = status === 'applying' || lockedElsewhere;

  return (
    <div className="my-1 rounded-lg border border-chat-line-strong bg-chat-surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-chat-accent">
            <PenLine className="w-3 h-3" />
            Suggested edit
          </div>
          <p className="mt-1 text-sm font-medium text-chat-text truncate">{edit.entity_name}</p>
          {edit.reason && <p className="mt-0.5 text-[13px] text-chat-muted">{edit.reason}</p>}
        </div>
        <Link
          to={`/admin/catalog?edit=${edit.entity_id}`}
          className="flex-shrink-0 -mr-1 p-1.5 rounded-md text-chat-faint hover:text-chat-text hover:bg-white/[0.04] transition-colors"
          title="Open in editor"
          aria-label="Open in editor"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {changeEntries.length > 0 && (
        <dl className="mx-3.5 mt-2.5 rounded-md border border-chat-line divide-y divide-chat-line text-[13px]">
          {changeEntries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 px-2.5 py-1.5">
              <dt className="text-chat-muted">{formatKey(key)}</dt>
              <dd className="text-chat-text font-medium tabular-nums truncate">{formatChange(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {error && <p className="mx-3.5 mt-2 text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 px-3.5 py-2.5">
        <button
          type="button"
          onClick={handleDecline}
          disabled={busy}
          className="h-8 px-3 rounded-md text-[13px] font-medium text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Apply
        </button>
      </div>
    </div>
  );
}
