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
  applyProposedEdits,
  declineProposedEdits,
} from '../services/aiChatService';

const AIChatContext = createContext(null);

const WS_OPEN_TIMEOUT_MS = 5000;

// Resolve with the socket once it is open; reject on error, close or timeout
function waitForOpen(ws) {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve(ws);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('error', onFail);
      ws.removeEventListener('close', onFail);
    };
    const onOpen = () => { cleanup(); resolve(ws); };
    const onFail = () => { cleanup(); reject(new Error('WS error')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('WS timeout')); }, WS_OPEN_TIMEOUT_MS);
    ws.addEventListener('open', onOpen);
    ws.addEventListener('error', onFail);
    ws.addEventListener('close', onFail);
  });
}

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

  const [mode, setMode] = useState('edit');
  const [model, setModel] = useState('auto');

  const wsRef = useRef(null);
  const wsSessionIdRef = useRef(null);
  const wsConnectingRef = useRef(null);
  const currentStreamIdRef = useRef(null);
  const reconnectTimer = useRef(null);
  const handleWSMessageRef = useRef(null);
  const onSessionCreatedRef = useRef(null);
  const lastStreamingActivityRef = useRef(null);
  const streamingStuckTimerRef = useRef(null);
  const currentSessionIdRef = useRef(currentSessionId);

  const STREAMING_STUCK_MS = 45000;

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

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
      wsSessionIdRef.current = null;
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
      wsSessionIdRef.current = null;
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

    if (type !== 'pong' && type !== 'title_update') {
      lastStreamingActivityRef.current = Date.now();
    }

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

      case 'text_chunk': {
        const chunk = data?.content || '';
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            const blocks = last.content_blocks || [];
            const newBlocks = [...blocks];
            if (newBlocks.length > 0 && newBlocks[newBlocks.length - 1].type === 'text') {
              newBlocks[newBlocks.length - 1] = { ...newBlocks[newBlocks.length - 1], content: (newBlocks[newBlocks.length - 1].content || '') + chunk };
            } else {
              newBlocks.push({ type: 'text', content: chunk });
            }
            return prev.slice(0, -1).concat({
              ...last,
              streamingContent: (last.streamingContent || '') + chunk,
              content_blocks: newBlocks,
            });
          }
          const newMsg = {
            id: currentStreamIdRef.current || `stream-${Date.now()}`,
            role: 'assistant',
            content: '',
            streamingContent: chunk,
            isStreaming: true,
            created_at: new Date().toISOString(),
            web_sources: [],
            suggested_edits: [],
            tool_calls: [],
            content_blocks: [{ type: 'text', content: chunk }],
          };
          return [...prev, newMsg];
        });
        setStreamingState(null);
        break;
      }

      case 'suggested_edit': {
        const edit = data?.edit;
        if (edit) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              const blocks = last.content_blocks || [];
              return prev.slice(0, -1).concat({
                ...last,
                suggested_edits: [...(last.suggested_edits || []), edit],
                content_blocks: [...blocks, { type: 'suggested_edit', data: edit }],
              });
            }
            return prev;
          });
        }
        break;
      }

      case 'edit_batch': {
        const batch = data?.batch;
        if (batch?.edits?.length) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last?.isStreaming) return prev;
            return prev.slice(0, -1).concat({
              ...last,
              content_blocks: [...(last.content_blocks || []), { type: 'edit_batch', data: batch }],
            });
          });
        }
        break;
      }

      case 'tool_call_started': {
        const d = data || {};
        setStreamingState({ type: 'thinking', message: d.label || 'Working...' });
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            const blocks = last.content_blocks || [];
            return prev.slice(0, -1).concat({
              ...last,
              content_blocks: [...blocks, {
                type: 'tool_call_in_progress',
                data: { name: d.name, label: d.label, args: d.args },
              }],
            });
          }
          if (last?.role === 'user') {
            const newMsg = {
              id: currentStreamIdRef.current || `stream-${Date.now()}`,
              role: 'assistant',
              content: '',
              streamingContent: '',
              isStreaming: true,
              created_at: new Date().toISOString(),
              web_sources: [],
              suggested_edits: [],
              tool_calls: [],
              content_blocks: [{
                type: 'tool_call_in_progress',
                data: { name: d.name, label: d.label, args: d.args },
              }],
            };
            return [...prev, newMsg];
          }
          return prev;
        });
        break;
      }

      case 'tool_call': {
        const toolCall = data?.tool_call;
        if (toolCall) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              const blocks = last.content_blocks || [];
              const newBlocks = [...blocks];
              // Tools run in parallel: finish the first still-running block for this tool
              const runningIdx = newBlocks.findIndex(
                b => b?.type === 'tool_call_in_progress' && b.data?.name === toolCall.name
              );
              if (runningIdx >= 0) {
                newBlocks[runningIdx] = { type: 'tool_call', data: toolCall };
              } else {
                newBlocks.push({ type: 'tool_call', data: toolCall });
              }
              return prev.slice(0, -1).concat({
                ...last,
                tool_calls: [...(last.tool_calls || []), toolCall],
                content_blocks: newBlocks,
              });
            }
            if (last?.role === 'user') {
              const newMsg = {
                id: currentStreamIdRef.current || `stream-${Date.now()}`,
                role: 'assistant',
                content: '',
                streamingContent: '',
                isStreaming: true,
                created_at: new Date().toISOString(),
                web_sources: [],
                suggested_edits: [],
                tool_calls: [toolCall],
                content_blocks: [{ type: 'tool_call', data: toolCall }],
              };
              return [...prev, newMsg];
            }
            return prev;
          });
        }
        break;
      }

      case 'message_done': {
        const msgId = data?.message_id;
        const tokens = data?.tokens || 0;
        const sources = data?.web_sources || [];
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return prev.slice(0, -1).concat({
              ...last,
              content: last.streamingContent || '',
              streamingContent: '',
              isStreaming: false,
              tokens_used: tokens,
              web_sources: sources,
              suggested_edits: last.suggested_edits || [],
              tool_calls: last.tool_calls || [],
              content_blocks: last.content_blocks || [],
              ...(msgId && { serverId: msgId }),
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

      case 'error': {
        const errMsg = data?.message || 'Something went wrong. Please try again.';
        setStreamingState(null);
        setIsStreaming(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return prev.slice(0, -1).concat({
              ...last,
              content: `Error: ${errMsg}`,
              streamingContent: '',
              isStreaming: false,
              isError: true,
            });
          }
          if (last?.role === 'user') {
            return [...prev, {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: `Error: ${errMsg}`,
              isError: true,
              created_at: new Date().toISOString(),
            }];
          }
          return prev;
        });
        break;
      }

      case 'pong':
        break;

      default:
        break;
    }
  }, [currentSessionId]);

  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage;
  }, [handleWSMessage]);

  const forceEndStreaming = useCallback((errorMessage = null) => {
    setStreamingState(null);
    setIsStreaming(false);
    setMessages(prev => {
      const last = prev[prev.length - 1];
      const fallbackError = errorMessage || 'The response was interrupted or timed out. You can retry or send a new message.';
      if (last?.isStreaming) {
        const content = last.streamingContent || last.content || '';
        return prev.slice(0, -1).concat({
          ...last,
          content: content || fallbackError,
          streamingContent: '',
          isStreaming: false,
          isError: !content,
        });
      }
      if (last?.role === 'user') {
        return [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: fallbackError,
          isError: true,
          created_at: new Date().toISOString(),
        }];
      }
      return prev;
    });
  }, []);

  // Resolves once the socket is open. Opening needs a ticket fetch first, so
  // concurrent calls for the same session share one pending connection.
  const connectWS = useCallback(async (sessionId) => {
    const ws = wsRef.current;
    if (ws && wsSessionIdRef.current === sessionId) {
      if (ws.readyState === WebSocket.OPEN) return ws;
      if (ws.readyState === WebSocket.CONNECTING) return waitForOpen(ws);
    }
    const pending = wsConnectingRef.current;
    if (pending && pending.sessionId === sessionId) return pending.promise;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      wsSessionIdRef.current = null;
    }

    const promise = (async () => {
      const newWs = await createChatWebSocket(sessionId);
      if (wsConnectingRef.current?.promise !== promise) {
        // A connection to another session started while fetching the ticket
        newWs.close(1000);
        throw new Error('WS superseded');
      }
      attachHandlers(newWs, sessionId);
      return waitForOpen(newWs);
    })();
    wsConnectingRef.current = { sessionId, promise };
    try {
      return await promise;
    } finally {
      if (wsConnectingRef.current?.promise === promise) wsConnectingRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const attachHandlers = (newWs, sessionId) => {
    wsRef.current = newWs;
    wsSessionIdRef.current = sessionId;

    newWs.onopen = () => {
      console.log('AI Chat WebSocket connected');
    };

    newWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (handleWSMessageRef.current) handleWSMessageRef.current(msg);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    newWs.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    newWs.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 4001) {
        forceEndStreaming('Connection lost. Reconnecting in a few seconds...');
        reconnectTimer.current = setTimeout(() => {
          if (currentSessionIdRef.current === sessionId) {
            connectWS(sessionId).catch((err) => console.error('WebSocket reconnect failed:', err));
          }
        }, 3000);
      }
    };
  };

  const interrupt = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  const sendMessage = useCallback(async (content, fileIds = [], opts = {}) => {
    if (!content.trim() && fileIds.length === 0) return;
    if (isStreaming) interrupt();

    const skipUserMessage = opts.skipUserMessage === true;

    let sessionId = currentSessionId;
    let shouldNotifySessionCreated = false;
    if (!sessionId) {
      try {
        const session = await createChat();
        sessionId = session.id;
        setCurrentSessionId(sessionId);
        setSessions(prev => [session, ...prev]);
        shouldNotifySessionCreated = true;
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
    lastStreamingActivityRef.current = Date.now();

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      try {
        await connectWS(sessionId);
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
      const msgMode = opts.mode ?? mode;
      const msgModel = opts.model ?? model;
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        file_ids: fileIds,
        mode: msgMode || 'edit',
        model: msgModel || 'auto',
      }));
      if (shouldNotifySessionCreated) {
        onSessionCreatedRef.current?.(sessionId);
      }
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
  }, [currentSessionId, isStreaming, connectWS, mode, model]);

  const redoMessage = useCallback(async (messageId) => {
    let userMsgToResend = null;
    let idToDelete = messageId;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId || m.serverId === messageId);
      if (idx < 0) return prev;
      const msg = prev[idx];
      if (msg.role !== 'assistant' || msg.isStreaming) return prev;
      idToDelete = msg.serverId || msg.id;
      const userIdx = prev.findLastIndex((m, i) => i < idx && m.role === 'user');
      if (userIdx < 0) return prev;
      userMsgToResend = prev[userIdx];
      return prev.slice(0, idx).concat(prev.slice(idx + 1));
    });
    if (userMsgToResend && currentSessionId) {
      try {
        await deleteChatMessage(currentSessionId, idToDelete);
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
    let idToDelete = messageId;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId || m.serverId === messageId);
      if (idx < 0) return prev;
      const msg = prev[idx];
      if (msg.role !== 'assistant' || !msg.isError) return prev;
      idToDelete = msg.serverId || msg.id;
      const userIdx = prev.findLastIndex((m, i) => i < idx && m.role === 'user');
      if (userIdx < 0) return prev;
      userMsgToResend = prev[userIdx];
      return prev.slice(0, idx).concat(prev.slice(idx + 1));
    });
    if (userMsgToResend && currentSessionId) {
      try {
        await deleteChatMessage(currentSessionId, idToDelete);
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

  const updateEditInMessage = useCallback((message, edit, status) => {
    const match = (e) =>
      e.entity_id === edit.entity_id && e.entity_type === edit.entity_type;
    const apply = (e) => (match(e) ? { ...e, status } : e);
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== message.id) return m;
        return {
          ...m,
          suggested_edits: (m.suggested_edits || []).map(apply),
          content_blocks: (m.content_blocks || []).map(b =>
            b.type === 'suggested_edit' && b.data
              ? { ...b, data: apply(b.data) }
              : b
          ),
        };
      })
    );
  }, []);

  const markEditApplied = useCallback((message, edit) => {
    updateEditInMessage(message, edit, 'applied');
  }, [updateEditInMessage]);

  const markEditDeclined = useCallback((message, edit) => {
    updateEditInMessage(message, edit, 'declined');
  }, [updateEditInMessage]);

  // ── AI-proposed change batches ────────────────────────────────────────────
  // Patch proposal rows (by id) inside every message's edit_batch blocks
  const patchProposals = useCallback((patches) => {
    if (!patches.length) return;
    const byId = new Map(patches.map(p => [p.id, p]));
    setMessages(prev => prev.map(m => {
      const blocks = m.content_blocks;
      if (!blocks?.some(b => b.type === 'edit_batch')) return m;
      let changed = false;
      const nextBlocks = blocks.map(b => {
        if (b.type !== 'edit_batch' || !b.data?.edits) return b;
        const edits = b.data.edits.map(e => {
          const patch = byId.get(e.id);
          if (!patch) return e;
          changed = true;
          return { ...e, ...patch };
        });
        return { ...b, data: { ...b.data, edits } };
      });
      return changed ? { ...m, content_blocks: nextBlocks } : m;
    }));
  }, []);

  const [busyProposalIds, setBusyProposalIds] = useState({});
  const markBusy = useCallback((ids, busy) => {
    setBusyProposalIds(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (busy) next[id] = true; else delete next[id]; });
      return next;
    });
  }, []);

  const resultToPatch = (r) => ({
    ...(r.proposal || {}),
    id: r.id,
    status: r.proposal?.status || r.status,
    error: r.error || null,
    conflict: !!r.conflict,
    current: r.current,
  });

  /** Apply proposals; returns the per-id results. force overrides "changed since proposed" conflicts. */
  const applyProposals = useCallback(async (ids, { force = false } = {}) => {
    const todo = ids.filter(id => !busyProposalIds[id]);
    if (!todo.length) return [];
    markBusy(todo, true);
    try {
      const { results } = await applyProposedEdits(todo, { force });
      patchProposals(results.map(resultToPatch));
      return results;
    } catch (err) {
      patchProposals(todo.map(id => ({ id, error: err?.message || 'Failed to apply' })));
      throw err;
    } finally {
      markBusy(todo, false);
    }
  }, [busyProposalIds, markBusy, patchProposals]);

  const declineProposals = useCallback(async (ids) => {
    const todo = ids.filter(id => !busyProposalIds[id]);
    if (!todo.length) return [];
    markBusy(todo, true);
    try {
      const { results } = await declineProposedEdits(todo);
      patchProposals(results.map(resultToPatch));
      return results;
    } catch (err) {
      patchProposals(todo.map(id => ({ id, error: err?.message || 'Failed to decline' })));
      throw err;
    } finally {
      markBusy(todo, false);
    }
  }, [busyProposalIds, markBusy, patchProposals]);

  // Shared lock so "Accept All" (SuggestedEditsBar) and an individual card's
  // Approve button (SuggestedEditCard) can't both apply the same suggested
  // edit at once.
  const [applyingEditKeys, setApplyingEditKeys] = useState({});

  const beginApplyingEdit = useCallback((key) => {
    setApplyingEditKeys(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const endApplyingEdit = useCallback((key) => {
    setApplyingEditKeys(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      wsSessionIdRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (streamingStuckTimerRef.current) clearInterval(streamingStuckTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentSessionId && isOpen) {
      connectWS(currentSessionId).catch((err) => console.error('WebSocket connect failed:', err));
    }
  }, [currentSessionId, isOpen, connectWS]);

  useEffect(() => {
    if (!isStreaming) {
      if (streamingStuckTimerRef.current) {
        clearInterval(streamingStuckTimerRef.current);
        streamingStuckTimerRef.current = null;
      }
      return;
    }
    streamingStuckTimerRef.current = setInterval(() => {
      const last = lastStreamingActivityRef.current;
      if (last && Date.now() - last > STREAMING_STUCK_MS) {
        if (streamingStuckTimerRef.current) {
          clearInterval(streamingStuckTimerRef.current);
          streamingStuckTimerRef.current = null;
        }
        forceEndStreaming('Response took too long. You can retry or try a shorter message.');
      }
    }, 5000);
    return () => {
      if (streamingStuckTimerRef.current) {
        clearInterval(streamingStuckTimerRef.current);
      }
    };
  }, [isStreaming, forceEndStreaming]);

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
    mode,
    model,

    // Actions
    openChat,
    closeChat,
    toggleFullScreen,
    switchSession,
    newChat,
    interrupt,
    sendMessage,
    redoMessage,
    retryMessage,
    uploadFile,
    removePendingFile,
    markEditApplied,
    markEditDeclined,
    applyProposals,
    declineProposals,
    busyProposalIds,
    applyingEditKeys,
    beginApplyingEdit,
    endApplyingEdit,
    loadSessions,
    setMessages,
    setSessions,
    loadOlderMessages,
    setOnSessionCreated: (cb) => { onSessionCreatedRef.current = cb; },
    setMode,
    setModel,
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
