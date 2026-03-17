import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { applyEdit } from '../../../services/aiChatService';

function getPendingEdits(messages) {
  const seen = new Set();
  const out = [];
  for (const msg of messages || []) {
    if (msg.role !== 'assistant') continue;
    const fromBlocks = (msg.content_blocks || [])
      .filter(b => b.type === 'suggested_edit' && b.data)
      .map(b => ({ message: msg, edit: b.data }));
    const fromLegacy = (msg.suggested_edits || [])
      .map(edit => ({ message: msg, edit }));
    for (const { message, edit } of [...fromBlocks, ...fromLegacy]) {
      const key = `${message.id}-${edit.entity_type}-${edit.entity_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const status = edit.status || 'pending';
      if (status !== 'applied' && status !== 'declined') {
        out.push({ message, edit });
      }
    }
  }
  return out;
}

export default function SuggestedEditsBar({ messages, onEditApplied, onEditDeclined }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const pending = getPendingEdits(messages);
  const count = pending.length;

  if (count < 2) return null;

  const handleAcceptAll = async () => {
    setIsAccepting(true);
    try {
      for (const { message, edit } of pending) {
        try {
          await applyEdit({
            entity_type: edit.entity_type,
            entity_id: edit.entity_id,
            changes: edit.changes,
          });
          onEditApplied?.(message, edit);
        } catch (err) {
          console.error('Failed to apply edit:', err);
        }
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectAll = () => {
    setIsRejecting(true);
    for (const { message, edit } of pending) {
      onEditDeclined?.(message, edit);
    }
    setIsRejecting(false);
  };

  const busy = isAccepting || isRejecting;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden border-t border-dark-700 bg-dark-800/80"
      >
        <div
          className="flex items-center justify-between gap-3 px-3 py-2"
          style={{
            paddingLeft: 'calc(0.5rem + env(safe-area-inset-left, 0px))',
            paddingRight: 'calc(0.5rem + env(safe-area-inset-right, 0px))',
          }}
        >
          <span className="text-[11px] text-dark-400">
            {count} suggested edit{count !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRejectAll}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-dark-400 hover:text-red-400 hover:bg-dark-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Reject all
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              disabled={busy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAccepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Accept all
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
