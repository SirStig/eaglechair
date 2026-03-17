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

  const SessionItem = ({ session }) => (
    <div
      onClick={() => onSelect(session.id)}
      className={`
        relative group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
        ${session.id === currentSessionId
          ? 'bg-chat-selected border border-chat-selected-border'
          : 'hover:bg-dark-800/70'
        }
      `}
    >
      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${session.id === currentSessionId ? 'text-white/70' : 'text-dark-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${session.id === currentSessionId ? 'text-white' : 'text-dark-100'}`}>
          {session.title || 'New Chat'}
        </p>
        <p className={`text-[10px] mt-0.5 ${session.id === currentSessionId ? 'text-white/70' : 'text-dark-400'}`}>
          {formatTime(session.updated_at)} · {session.message_count || 0} msgs
        </p>
      </div>

      {session.pinned && (
        <Pin className={`w-3 h-3 flex-shrink-0 mt-0.5 ${session.id === currentSessionId ? 'text-white/80' : 'text-chat-accent'}`} />
      )}

      {/* Actions menu */}
      <div className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpenId === session.id) {
              setMenuOpenId(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuRect(rect);
              setMenuOpenId(session.id);
            }
          }}
          className={`p-0.5 rounded hover:bg-dark-600 ${session.id === currentSessionId ? 'text-white/70 hover:text-white' : 'text-dark-400 hover:text-dark-100'}`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown menu (portal to avoid scroll clipping) */}
      {menuOpenId === session.id && menuRect && createPortal(
        <div
          className="fixed z-[9999] bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[140px] max-w-[calc(100vw-2rem)]"
          style={{
            top: menuRect.bottom + 4,
            right: window.innerWidth - menuRect.right,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => handlePin(session, e)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dark-100 hover:bg-dark-700 hover:text-white"
          >
            <Pin className="w-3 h-3" />
            {session.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={(e) => handleArchive(session, e)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dark-100 hover:bg-dark-700 hover:text-white"
          >
            <Archive className="w-3 h-3" />
            Archive
          </button>
          <div className="border-t border-dark-700 my-1" />
          <button
            onClick={(e) => handleDelete(session, e)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );

  return (
    <div className="relative w-full sm:w-56 flex-shrink-0 flex flex-col h-full overflow-hidden min-w-0 bg-dark-950 border-r border-dark-600/80 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.4)]">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-chat-accent/50 via-chat-accent/20 to-transparent pointer-events-none" aria-hidden />
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-dark-500 px-0.5">Chats</p>
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="p-2 -m-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-chat-button hover:bg-chat-button-hover text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        <div className="px-3 pb-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark-800/80 border border-dark-600 rounded-lg pl-7 pr-2.5 py-2 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-chat-focus focus:ring-1 focus:ring-chat-focus/30"
            />
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 min-h-0" onClick={() => setMenuOpenId(null)}>
          <div
            onClick={onNew}
            className={`
              relative flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
              ${!currentSessionId
                ? 'bg-chat-selected border border-chat-selected-border'
                : 'hover:bg-dark-800/70'
              }
            `}
          >
            <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${!currentSessionId ? 'text-white/70' : 'text-dark-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${!currentSessionId ? 'text-white' : 'text-dark-100'}`}>
                New Chat
              </p>
              <p className={`text-[10px] mt-0.5 ${!currentSessionId ? 'text-white/70' : 'text-dark-400'}`}>
                Start a conversation
              </p>
            </div>
          </div>
          {pinnedSessions.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-widest text-dark-500 px-2.5 pt-2 pb-1">Pinned</p>
              {pinnedSessions.map(s => <SessionItem key={s.id} session={s} />)}
              <div className="border-t border-dark-700/60 my-2 mx-2" />
            </>
          )}

          {regularSessions.length > 0 ? (
            <>
              {pinnedSessions.length > 0 && (
                <p className="text-[9px] uppercase tracking-widest text-dark-500 px-2.5 pt-1 pb-1">Recent</p>
              )}
              {regularSessions.map(s => <SessionItem key={s.id} session={s} />)}
            </>
          ) : (
            !pinnedSessions.length && (
              <div className="text-center py-10 px-4">
                <div className="w-10 h-10 rounded-xl bg-dark-800/60 border border-dark-700 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-5 h-5 text-dark-500" />
                </div>
                <p className="text-xs text-dark-500">No chats yet</p>
                <p className="text-[10px] text-dark-600 mt-1">Start a new chat to begin</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
