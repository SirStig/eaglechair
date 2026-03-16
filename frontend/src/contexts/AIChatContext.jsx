/**
 * AI Chat Context
 *
 * Manages floating chat widget state across all admin pages.
 * Persists chat state during navigation (widget stays open, same chat).
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  createChat,
  getChat,
  listChats,
  createChatWebSocket,
  uploadFileToChat,
  deleteChatMessage,
} from '../services/aiChatService';

const AIChatContext = createContext(null);

export function AIChatProvider({ children }) {
  // Widget visibility state
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Chat data
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // {id, role, content, web_sources, file_ids, created_at, isStreaming, streamingContent, status}
  const [files, setFiles] = useState([]); // Files attached to current session

  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState(null); // {type: 'thinking'|'searching'|'fetching_url'|'calculating', data: {}}
  const [webSources, setWebSources] = useState([]); // Sources from current/last response

  // Pending files for next message
  const [pendingFiles, setPendingFiles] = useState([]); // [{file_id, filename, file_type}]

  // WS ref
  const wsRef = useRef(null);
  const currentStreamIdRef = useRef(null);
  const reconnectTimer = useRef(null);
  const handleWSMessageRef = useRef(null);
  const onSessionCreatedRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await listChats();
      setSessions(data);
      return data;
    } catch (err) {
      console.error('Failed to load chats:', err);
      return [];
    }
  }, []);

  const openChat = useCallback(async () => {
    setIsOpen(true);
    try {
      await loadSessions();
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  }, [loadSessions]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsFullScreen(false);
  }, []);

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  const switchSession = useCallback(async (sessionId) => {
    if (sessionId === currentSessionId) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setCurrentSessionId(sessionId);
    setMessages([]);
    setWebSources([]);
    setStreamingState(null);
    setPendingFiles([]);
    setFiles([]);
    setHasMoreMessages(false);

    if (!sessionId) {
      setIsLoadingChat(false);
      return;
    }

    setIsLoadingChat(true);
    try {
      const { messages: msgs, files: sessionFiles, has_more } = await getChat(sessionId);
      setMessages(msgs.map(m => ({
        ...m,
        isStreaming: false,
        streamingContent: '',
      })));
      setFiles(sessionFiles || []);
      setHasMoreMessages(has_more ?? false);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setIsLoadingChat(false);
    }
  }, [currentSessionId]);

  const loadOlderMessages = useCallback(async () => {
    if (!currentSessionId || !hasMoreMessages || isLoadingOlder || messages.length === 0) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    setIsLoadingOlder(true);
    try {
      const { messages: olderMsgs, has_more } = await getChat(currentSessionId, {
        limit: 50,
        beforeId: oldestId,
      });
      if (olderMsgs?.length > 0) {
        const normalized = olderMsgs.map(m => ({
          ...m,
          isStreaming: false,
          streamingContent: '',
        }));
        setMessages(prev => [...normalized, ...prev]);
      }
      setHasMoreMessages(has_more ?? false);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [currentSessionId, hasMoreMessages, isLoadingOlder, messages.length]);

  const newChat = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentSessionId(null);
    setMessages([]);
    setWebSources([]);
    setStreamingState(null);
    setPendingFiles([]);
    setFiles([]);
    return null;
  }, []);

  const handleWSMessage = useCallback((msg) => {
    const { type, data } = msg;

    switch (type) {
      case 'thinking':
        setStreamingState({ type: 'thinking', message: data?.message || 'Thinking...' });
        break;

      case 'searching':
        setStreamingState({ type: 'searching', query: data?.query, count: data?.search_count });
        break;

      case 'search_results':
        setWebSources(prev => {
          const existing = new Set(prev.map(s => s.url));
          const newSources = (data?.sources || []).filter(s => !existing.has(s.url));
          return [...prev, ...newSources].slice(0, 20);
        });
        setStreamingState({ type: 'search_results', sources: data?.sources });
        break;

      case 'fetching_url':
        setStreamingState({ type: 'fetching_url', url: data?.url });
        break;

      case 'calculating':
        setStreamingState({ type: 'calculating', expression: data?.expression });
        break;

      case 'text_chunk':
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return prev.slice(0, -1).concat({
              ...last,
              streamingContent: (last.streamingContent || '') + (data?.content || ''),
            });
          }
          const newMsg = {
            id: currentStreamIdRef.current || `stream-${Date.now()}`,
            role: 'assistant',
            content: '',
            streamingContent: data?.content || '',
            isStreaming: true,
            created_at: new Date().toISOString(),
            web_sources: [],
          };
          return [...prev, newMsg];
        });
        setStreamingState(null);
        break;

      case 'message_done': {
        const msgId = data?.message_id;
        const tokens = data?.tokens || 0;
        const sources = data?.web_sources || [];
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return prev.slice(0, -1).concat({
              ...last,
              id: msgId || last.id,
              content: last.streamingContent || '',
              streamingContent: '',
              isStreaming: false,
              tokens_used: tokens,
              web_sources: sources,
            });
          }
          return prev;
        });
        setStreamingState(null);
        setIsStreaming(false);
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId
            ? { ...s, total_tokens: (s.total_tokens || 0) + tokens, message_count: (s.message_count || 0) + 1 }
            : s
        ));
        break;
      }

      case 'title_update':
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId ? { ...s, title: data?.title } : s
        ));
        break;

      case 'error':
        setStreamingState(null);
        setIsStreaming(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return prev.slice(0, -1).concat({
              ...last,
              content: `Error: ${data?.message || 'Unknown error'}`,
              streamingContent: '',
              isStreaming: false,
              isError: true,
            });
          }
          return prev;
        });
        break;

      case 'pong':
        break;

      default:
        break;
    }
  }, [currentSessionId]);

  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage;
  }, [handleWSMessage]);

  const connectWS = useCallback((sessionId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = createChatWebSocket(sessionId);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('AI Chat WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (handleWSMessageRef.current) handleWSMessageRef.current(msg);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    ws.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 4001) {
        // Auto-reconnect after 3s (unless auth error)
        reconnectTimer.current = setTimeout(() => {
          if (currentSessionId === sessionId) {
            connectWS(sessionId);
          }
        }, 3000);
      }
    };

    return ws;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (content, fileIds = [], opts = {}) => {
    if (isStreaming) return;
    if (!content.trim() && fileIds.length === 0) return;

    const skipUserMessage = opts.skipUserMessage === true;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const session = await createChat();
        sessionId = session.id;
        setCurrentSessionId(sessionId);
        setSessions(prev => [session, ...prev]);
        onSessionCreatedRef.current?.(sessionId);
      } catch (err) {
        console.error('Failed to create chat:', err);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Failed to start chat. Please try again.',
          isError: true,
          created_at: new Date().toISOString(),
        }]);
        return;
      }
    }

    if (!skipUserMessage) {
      const userMsgId = `user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: userMsgId,
        role: 'user',
        content,
        file_ids: fileIds,
        created_at: new Date().toISOString(),
        isStreaming: false,
      }]);
    }

    setIsStreaming(true);
    setStreamingState({ type: 'thinking', message: 'Thinking...' });
    setWebSources([]);

    let ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = connectWS(sessionId);
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WS timeout')), 5000);
          ws.onopen = () => { clearTimeout(timeout); resolve(); };
          ws.onerror = () => { clearTimeout(timeout); reject(new Error('WS error')); };
        });
      } catch {
        setIsStreaming(false);
        setStreamingState(null);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Failed to connect to AI. Please try again.',
          isError: true,
          created_at: new Date().toISOString(),
        }]);
        return;
      }
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        file_ids: fileIds,
      }));
    } else {
      setIsStreaming(false);
      setStreamingState(null);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Failed to connect to AI. Please try again.',
        isError: true,
        created_at: new Date().toISOString(),
      }]);
    }
  }, [currentSessionId, isStreaming, connectWS]);

  const redoMessage = useCallback(async (messageId) => {
    let userMsgToResend = null;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx < 0) return prev;
      const msg = prev[idx];
      if (msg.role !== 'assistant' || msg.isStreaming) return prev;
      const userIdx = prev.findLastIndex((m, i) => i < idx && m.role === 'user');
      if (userIdx < 0) return prev;
      userMsgToResend = prev[userIdx];
      return prev.slice(0, idx).concat(prev.slice(idx + 1));
    });
    if (userMsgToResend && currentSessionId) {
      try {
        await deleteChatMessage(currentSessionId, messageId);
      } catch (err) {
        if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        } else {
          console.error('Failed to delete message:', err);
        }
      }
      sendMessage(userMsgToResend.content, userMsgToResend.file_ids || [], { skipUserMessage: true });
    }
  }, [currentSessionId, sendMessage]);

  const retryMessage = useCallback(async (messageId) => {
    let userMsgToResend = null;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx < 0) return prev;
      const msg = prev[idx];
      if (msg.role !== 'assistant' || !msg.isError) return prev;
      const userIdx = prev.findLastIndex((m, i) => i < idx && m.role === 'user');
      if (userIdx < 0) return prev;
      userMsgToResend = prev[userIdx];
      return prev.slice(0, idx).concat(prev.slice(idx + 1));
    });
    if (userMsgToResend && currentSessionId) {
      try {
        await deleteChatMessage(currentSessionId, messageId);
      } catch (err) {
        if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        } else {
          console.error('Failed to delete message:', err);
        }
      }
      sendMessage(userMsgToResend.content, userMsgToResend.file_ids || [], { skipUserMessage: true });
    }
  }, [currentSessionId, sendMessage]);

  const uploadFile = useCallback(async (file) => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const session = await createChat();
        sessionId = session.id;
        setCurrentSessionId(sessionId);
        setSessions(prev => [session, ...prev]);
        onSessionCreatedRef.current?.(sessionId);
      } catch (err) {
        console.error('Failed to create chat:', err);
        throw err;
      }
    }
    try {
      const result = await uploadFileToChat(sessionId, file);
      const fileInfo = {
        file_id: result.file_id,
        filename: result.filename,
        file_type: result.file_type,
        file_size: result.file_size,
      };
      setPendingFiles(prev => [...prev, fileInfo]);
      return fileInfo;
    } catch (err) {
      console.error('File upload failed:', err);
      throw err;
    }
  }, [currentSessionId]);

  const removePendingFile = useCallback((fileId) => {
    setPendingFiles(prev => prev.filter(f => f.file_id !== fileId));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  // Load session messages when switching
  useEffect(() => {
    if (currentSessionId && isOpen) {
      connectWS(currentSessionId);
    }
  }, [currentSessionId, isOpen, connectWS]);

  const value = {
    // State
    isOpen,
    isFullScreen,
    sessions,
    currentSessionId,
    messages,
    files,
    isStreaming,
    streamingState,
    webSources,
    pendingFiles,
    isLoadingChat,
    hasMoreMessages,
    isLoadingOlder,

    // Actions
    openChat,
    closeChat,
    toggleFullScreen,
    switchSession,
    newChat,
    sendMessage,
    redoMessage,
    retryMessage,
    uploadFile,
    removePendingFile,
    loadSessions,
    setMessages,
    setSessions,
    loadOlderMessages,
    setOnSessionCreated: (cb) => { onSessionCreatedRef.current = cb; },
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider');
  return ctx;
}
