/**
 * AI Chat Sidebar
 * Shows chat history list with search and actions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Pin, Archive, Trash2, MoreHorizontal, MessageSquare } from 'lucide-react';
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

export default function AIChatSidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, onUpdate }) {
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
        relative group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${session.id === currentSessionId
          ? 'bg-chat-selected border border-chat-selected-border'
          : 'hover:bg-dark-700/50'
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
    <div className="w-full sm:w-52 flex-shrink-0 flex flex-col bg-dark-900 border-r border-dark-700 overflow-hidden min-w-0">
      {/* Header */}
      <div className="p-3 border-b border-dark-700">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-chat-button hover:bg-chat-button-hover text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-dark-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-6 pr-2 py-1.5 text-xs text-dark-100 placeholder-dark-400 focus:outline-none focus:border-chat-focus"
          />
        </div>
      </div>

      {/* Chat list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5" onClick={() => setMenuOpenId(null)}>
        {pinnedSessions.length > 0 && (
          <>
            <p className="text-[9px] uppercase tracking-widest text-dark-400 px-2 pt-1 pb-0.5">Pinned</p>
            {pinnedSessions.map(s => <SessionItem key={s.id} session={s} />)}
            <div className="border-t border-dark-700/50 my-1" />
          </>
        )}

        {regularSessions.length > 0 ? (
          <>
            {pinnedSessions.length > 0 && (
              <p className="text-[9px] uppercase tracking-widest text-dark-400 px-2 pt-1 pb-0.5">Recent</p>
            )}
            {regularSessions.map(s => <SessionItem key={s.id} session={s} />)}
          </>
        ) : (
          !pinnedSessions.length && (
            <div className="text-center py-8">
              <MessageSquare className="w-6 h-6 text-dark-500 mx-auto mb-2" />
              <p className="text-xs text-dark-400">No chats yet</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
