import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Edit2, Loader2 } from 'lucide-react';
import { applyEdit } from '../../../services/aiChatService';

function formatChange(key, value) {
  if (key === 'base_price' && typeof value === 'number') {
    return `$${(value / 100).toFixed(2)}`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function SuggestedEditCard({ edit, onApplied, onDeclined }) {
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState(null);

  const handleApprove = async () => {
    setStatus('applying');
    setError(null);
    try {
      await applyEdit({
        entity_type: edit.entity_type,
        entity_id: edit.entity_id,
        changes: edit.changes,
      });
      setStatus('applied');
      onApplied?.(edit);
    } catch (err) {
      setError(err?.message || 'Failed to apply');
      setStatus('pending');
    }
  };

  const handleDecline = () => {
    setStatus('declined');
    onDeclined?.(edit);
  };

  if (status === 'applied') {
    return (
      <div className="mt-2 p-2.5 rounded-lg bg-green-900/20 border border-green-700/50 text-green-400 text-xs">
        <span className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Edit applied to {edit.entity_name}
        </span>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="mt-2 p-2.5 rounded-lg bg-dark-700/50 border border-dark-600 text-dark-400 text-xs">
        <span className="flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" />
          Edit declined
        </span>
      </div>
    );
  }

  const changeEntries = Object.entries(edit.changes || {});

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Edit2 className="w-3 h-3 text-primary-400 flex-shrink-0" />
            <span className="text-[10px] font-medium text-primary-400 uppercase tracking-wide">Suggested edit</span>
          </div>
          <p className="text-xs text-dark-200 font-medium">{edit.entity_name}</p>
          {edit.reason && (
            <p className="text-[11px] text-dark-400 mt-0.5">{edit.reason}</p>
          )}
          <div className="mt-1.5 space-y-0.5">
            {changeEntries.map(([key, value]) => (
              <div key={key} className="text-[11px] text-dark-300">
                <span className="text-dark-500">{key.replace(/_/g, ' ')}:</span>{' '}
                {formatChange(key, value)}
              </div>
            ))}
          </div>
          {error && (
            <p className="text-[10px] text-red-400 mt-1">{error}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            to={`/admin/catalog?edit=${edit.entity_id}`}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-colors"
            title="Open in editor"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleDecline}
            disabled={status === 'applying'}
            className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-700/50 transition-colors disabled:opacity-50"
            title="Decline"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={status === 'applying'}
            className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
            title="Apply"
          >
            {status === 'applying' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
