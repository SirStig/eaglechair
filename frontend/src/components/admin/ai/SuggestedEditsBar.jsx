import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { applyEdit } from '../../../services/aiChatService';
import { useAIChat } from '../../../contexts/AIChatContext';

function getEditKey(edit) {
  return `${edit.entity_type}:${edit.entity_id}`;
}

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
  const { applyingEditKeys, beginApplyingEdit, endApplyingEdit } = useAIChat();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const pending = getPendingEdits(messages);
  const count = pending.length;

  if (count < 2) return null;

  const handleAcceptAll = async () => {
    setIsAccepting(true);
    try {
      for (const { message, edit } of pending) {
        const key = getEditKey(edit);
        if (applyingEditKeys[key]) continue; // already being applied (e.g. an individual card's Approve)
        beginApplyingEdit(key);
        try {
          await applyEdit({
            entity_type: edit.entity_type,
            entity_id: edit.entity_id,
            changes: edit.changes,
          });
          onEditApplied?.(message, edit);
        } catch (err) {
          console.error('Failed to apply edit:', err);
        } finally {
          endApplyingEdit(key);
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

  // Also disable while any pending edit is being applied by an individual
  // card's Approve button, so Accept All can't double-submit it.
  const anyLocked = pending.some(({ edit }) => applyingEditKeys[getEditKey(edit)]);
  const busy = isAccepting || isRejecting || anyLocked;

  return (
    <AnimatePresence>
      <m.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden flex-shrink-0"
        style={{
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(0.75rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="w-full max-w-3xl mx-auto pt-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-chat-line-strong bg-chat-surface pl-3.5 pr-1.5 py-1.5">
            <span className="flex items-center gap-2 text-[13px] text-chat-muted min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-chat-accent flex-shrink-0" />
              <span className="truncate">
                <span className="text-chat-text font-medium">{count}</span>
                <span className="hidden sm:inline"> suggested</span> edit{count !== 1 ? 's' : ''}
                <span className="hidden sm:inline"> pending</span>
              </span>
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleRejectAll}
                disabled={busy}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[13px] font-medium text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRejecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Decline all
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                disabled={busy}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[13px] font-semibold bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Apply all
              </button>
            </div>
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
