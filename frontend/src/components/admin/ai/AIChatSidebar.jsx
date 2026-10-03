/**
 * AI Chat Sidebar
 * Shows chat history list with search and actions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Pin, Archive, Trash2, MoreHorizontal, MessageSquare, X } from 'lucide-react';
import { updateChat, deleteChat } from '../../../services/aiChatService';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export default function AIChatSidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, onUpdate, onClose, showCloseButton }) {
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuRect, setMenuRect] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const onScroll = () => setMenuOpenId(null);
    const el = listRef.current;
    el?.addEventListener('scroll', onScroll);
    return () => el?.removeEventListener('scroll', onScroll);
  }, [menuOpenId]);

  useEffect(() => {
    if (!menuOpenId) {
      setMenuRect(null);
      return;
    }
    const onClick = () => setMenuOpenId(null);
    const t = setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onClick);
    };
  }, [menuOpenId]);

  const filtered = sessions.filter(s =>
    !s.is_archived &&
    (search === '' || s.title.toLowerCase().includes(search.toLowerCase()))
  );

  const pinnedSessions = filtered.filter(s => s.pinned);
  const regularSessions = filtered.filter(s => !s.pinned);

  const handlePin = useCallback(async (session, e) => {
    e.stopPropagation();
    try {
      await updateChat(session.id, { pinned: !session.pinned });
      onUpdate(session.id, { pinned: !session.pinned });
    } catch (err) {
      console.error('Failed to pin chat:', err);
    }
    setMenuOpenId(null);
  }, [onUpdate]);

  const handleArchive = useCallback(async (session, e) => {
    e.stopPropagation();
    try {
      await updateChat(session.id, { is_archived: true });
      onUpdate(session.id, { is_archived: true });
    } catch (err) {
      console.error('Failed to archive chat:', err);
    }
    setMenuOpenId(null);
  }, [onUpdate]);

  const handleDelete = useCallback(async (session, e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await deleteChat(session.id);
      onDelete(session.id);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
    setMenuOpenId(null);
  }, [onDelete]);

  const SessionItem = ({ session }) => {
    const active = session.id === currentSessionId;
    const menuOpen = menuOpenId === session.id;
    return (
      <div
        onClick={() => onSelect(session.id)}
        className={`
          relative group flex items-center gap-2 pl-3 pr-1.5 py-2 rounded-lg cursor-pointer transition-colors
          ${active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}
        `}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] truncate ${active ? 'text-white font-medium' : 'text-chat-text'}`}>
            {session.title || 'New chat'}
          </p>
          <p className="text-[11px] text-chat-faint mt-0.5 truncate">
            {formatTime(session.updated_at)}
            {session.message_count ? ` · ${session.message_count} messages` : ''}
          </p>
        </div>

        {session.pinned && !menuOpen && (
          <Pin className="w-3 h-3 flex-shrink-0 text-chat-faint sm:group-hover:hidden" />
        )}

        {/* Actions menu */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) {
              setMenuOpenId(null);
            } else {
              setMenuRect(e.currentTarget.getBoundingClientRect());
              setMenuOpenId(session.id);
            }
          }}
          className={`flex-shrink-0 p-1 rounded-md text-chat-faint hover:text-chat-text hover:bg-white/[0.08] transition-opacity ${
            menuOpen ? 'opacity-100 bg-white/[0.08]' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
          aria-label="Chat actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Dropdown menu (portal to avoid scroll clipping) */}
        {menuOpen && menuRect && createPortal(
          <div
            className="ai-chat fixed z-[9999] w-44 p-1 rounded-xl bg-chat-raised border border-chat-line-strong shadow-2xl shadow-black/50"
            style={{
              top: menuRect.bottom + 4,
              left: Math.min(menuRect.left, window.innerWidth - 184),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => handlePin(session, e)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] text-chat-text hover:bg-white/[0.06]"
            >
              <Pin className="w-3.5 h-3.5 text-chat-muted" />
              {session.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={(e) => handleArchive(session, e)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] text-chat-text hover:bg-white/[0.06]"
            >
              <Archive className="w-3.5 h-3.5 text-chat-muted" />
              Archive
            </button>
            <div className="h-px bg-chat-line my-1 mx-1" />
            <button
              onClick={(e) => handleDelete(session, e)}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}
      </div>
    );
  };

  const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-medium text-chat-faint px-3 pt-3 pb-1.5">{children}</p>
  );

  return (
    <div className="ai-chat w-full flex-shrink-0 flex flex-col h-full overflow-hidden min-w-0 bg-chat-surface border-r border-chat-line">
      <div className="p-3 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="flex-1 h-9 flex items-center gap-2 px-3 rounded-lg border border-chat-line-strong bg-chat-raised hover:bg-white/[0.06] text-[13px] font-medium text-chat-text transition-colors"
          >
            <Plus className="w-4 h-4 text-chat-muted" />
            New chat
          </button>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-chat-muted hover:text-chat-text hover:bg-white/[0.06] transition-colors touch-manipulation"
              aria-label="Close chat history"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-chat-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 bg-transparent border border-chat-line rounded-lg pl-8 pr-3 text-[13px] text-chat-text placeholder-chat-faint focus:outline-none focus:border-chat-line-strong focus:bg-white/[0.02]"
          />
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-3 min-h-0" onClick={() => setMenuOpenId(null)}>
        {pinnedSessions.length > 0 && (
          <>
            <SectionLabel>Pinned</SectionLabel>
            <div className="space-y-px">
              {pinnedSessions.map(s => <SessionItem key={s.id} session={s} />)}
            </div>
          </>
        )}

        {regularSessions.length > 0 && (
          <>
            <SectionLabel>Recent</SectionLabel>
            <div className="space-y-px">
              {regularSessions.map(s => <SessionItem key={s.id} session={s} />)}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-5 h-5 text-chat-faint mx-auto mb-2.5" />
            <p className="text-[13px] text-chat-muted">{search ? 'No matching chats' : 'No chats yet'}</p>
            {!search && <p className="text-xs text-chat-faint mt-1">Your conversations will appear here.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
