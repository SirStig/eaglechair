/**
 * AI Chat Full-Screen Page
 * Full-screen chat experience at /admin/ai
 * Includes memory management and training document panel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Brain,
  BookOpen,
  Menu,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Database,
  Minimize2,
  X,
} from 'lucide-react';
import { useAIChat } from '../../contexts/AIChatContext';
import AIChatMessage from '../../components/admin/ai/AIChatMessage';
import AIChatInput from '../../components/admin/ai/AIChatInput';
import AIChatStreamStatus from '../../components/admin/ai/AIChatStreamStatus';
import AIChatSidebar from '../../components/admin/ai/AIChatSidebar';
import ChatMessageList from '../../components/admin/ai/ChatMessageList';
import {
  getMemory,
  deleteMemory,
  listTrainingDocs,
  uploadTrainingDoc,
  uploadTrainingBatch,
  deleteTrainingDoc,
} from '../../services/aiChatService';

// ─────────────────────────────────────────────────────────────────────────────
// Right Panel: Memory & Training Tabs
// ─────────────────────────────────────────────────────────────────────────────

function MemoryPanel({ onClose, showClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMemory();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (key) => {
    if (!confirm(`Delete memory: "${key}"?`)) return;
    try {
      await deleteMemory(key);
      setMemories(prev => prev.filter(m => m.key !== key));
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const filtered = memories.filter(m =>
    search === '' || m.key.toLowerCase().includes(search.toLowerCase()) || m.value.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map(m => m.category))];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-chat-memory" />
          <h3 className="text-sm font-semibold text-dark-50">AI Memory</h3>
          <span className="text-[10px] bg-dark-700 text-dark-300 rounded-full px-2 py-0.5">{memories.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {showClose && (
            <button onClick={onClose} className="p-2 -m-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors touch-manipulation" title="Close">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={load} className="p-2 -m-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors touch-manipulation">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-dark-700">
        <input
          type="text"
          placeholder="Search memory..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:border-chat-focus"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 text-dark-600 mx-auto mb-2" />
            <p className="text-xs text-dark-500">
              {memories.length === 0 ? 'No memories yet. Chat with the AI and it will remember important facts.' : 'No matches found.'}
            </p>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat}>
              <p className="text-[9px] uppercase tracking-widest text-dark-500 mb-1.5 px-1">
                {cat}
              </p>
              {filtered.filter(m => m.category === cat).map(m => (
                <div key={m.key} className="group bg-dark-800 border border-dark-700 rounded-lg p-2.5 mb-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-dark-200 mb-0.5">{m.key}</p>
                      <p className="text-xs text-dark-300 leading-relaxed">{m.value}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <div
                        className="w-1.5 h-6 rounded-full"
                        style={{ backgroundColor: `hsl(${m.importance * 120}, 70%, 50%)` }}
                        title={`Importance: ${(m.importance * 100).toFixed(0)}%`}
                      />
                      <button
                        onClick={() => handleDelete(m.key)}
                        className="text-dark-500 hover:text-red-400 transition-colors p-1.5 -m-1 rounded touch-manipulation"
                        title="Delete memory"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrainingStatusBadge({ status }) {
  const config = {
    pending: { icon: Clock, color: 'text-chat-accent-muted', bg: 'bg-dark-700/80', label: 'Pending' },
    processing: { icon: Loader2, color: 'text-chat-status-fetching', bg: 'bg-chat-status-fetching/20', label: 'Processing', spin: true },
    completed: { icon: CheckCircle, color: 'text-chat-status-success', bg: 'bg-chat-status-success/20', label: 'Ready' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/30', label: 'Failed' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.bg} ${c.color}`}>
      <Icon className={`w-2.5 h-2.5 ${c.spin ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

function TrainingPanel({ onClose, showClose }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ name: '', description: '', tags: '' });
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await listTrainingDocs();
      setDocs(data);
    } catch (err) {
      if (!silent) console.error('Failed to load training docs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'processing' || d.status === 'pending');
    if (!hasProcessing) return;
    const timer = setInterval(() => load(true), 3000);
    return () => clearInterval(timer);
  }, [docs, load]);

  const handleUpload = async () => {
    if (batchMode) {
      if (!selectedFiles.length) {
        setUploadError('Select at least one file');
        return;
      }
      setUploading(true);
      setUploadError(null);
      setUploadProgress(null);
      try {
        await uploadTrainingBatch(selectedFiles, (p) => setUploadProgress(p));
        setShowUpload(false);
        setBatchMode(false);
        setSelectedFiles([]);
        await load();
      } catch (err) {
        setUploadError(err.message || 'Batch upload failed');
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
      return;
    }
    if (!selectedFile || !form.name.trim()) {
      setUploadError('Name and file are required');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadTrainingDoc(selectedFile, form.name, form.description, form.tags);
      setShowUpload(false);
      setForm({ name: '', description: '', tags: '' });
      setSelectedFile(null);
      await load();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}" from training data?`)) return;
    try {
      await deleteTrainingDoc(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete training doc:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-chat-training" />
          <h3 className="text-sm font-semibold text-dark-50">Training</h3>
          <span className="text-[10px] bg-dark-700 text-dark-300 rounded-full px-2 py-0.5">{docs.length}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {showClose && (
            <button onClick={onClose} className="p-2 -m-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors touch-manipulation" title="Close">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={load} className="p-2 -m-2 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded-lg transition-colors touch-manipulation">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1 px-2 py-1 bg-chat-training/30 hover:bg-chat-training/50 border border-chat-training/50 text-chat-training rounded-lg text-xs transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* Upload form */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-dark-700"
          >
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-dark-200">Add Training Document</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchMode}
                    onChange={e => { setBatchMode(e.target.checked); setSelectedFile(null); setSelectedFiles([]); }}
                    className="rounded border-dark-500"
                  />
                  <span className="text-[10px] text-dark-400">Batch (use file names)</span>
                </label>
              </div>
              {!batchMode && (
                <>
                  <input
                    type="text"
                    placeholder="Document name *"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:border-chat-training"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:border-chat-training"
                  />
                  <input
                    type="text"
                    placeholder="Tags (comma-separated)"
                    value={form.tags}
                    onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-xs text-dark-200 placeholder-dark-500 focus:outline-none focus:border-chat-training"
                  />
                </>
              )}
              <div
                onClick={() => batchMode ? batchInputRef.current?.click() : fileInputRef.current?.click()}
                className="border-2 border-dashed border-dark-600 hover:border-chat-training rounded-lg p-3 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 text-dark-400 mx-auto mb-1" />
                {batchMode ? (
                  selectedFiles.length > 0 ? (
                    <p className="text-xs text-chat-training">{selectedFiles.length} file(s) selected</p>
                  ) : (
                    <p className="text-xs text-dark-400">Click to select files (PDF, CSV, Excel, TXT)</p>
                  )
                ) : selectedFile ? (
                  <p className="text-xs text-chat-training">{selectedFile.name}</p>
                ) : (
                  <p className="text-xs text-dark-400">Click to select file (PDF, CSV, Excel, TXT)</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,.txt,.md"
                onChange={e => setSelectedFile(e.target.files[0] || null)}
              />
              <input
                ref={batchInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls,.txt,.md"
                multiple
                onChange={e => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
              {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-1.5 bg-chat-training/50 hover:bg-chat-training/70 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? (
                    uploadProgress ? `Batch ${uploadProgress.batch}/${uploadProgress.totalBatches}...` : 'Uploading...'
                  ) : batchMode ? (
                    `Upload ${selectedFiles.length || 0} & Train`
                  ) : (
                    'Upload & Train'
                  )}
                </button>
                <button
                  onClick={() => { setShowUpload(false); setUploadError(null); }}
                  className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Docs list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-8 h-8 text-dark-600 mx-auto mb-2" />
            <p className="text-xs text-dark-500">No training data yet.</p>
            <p className="text-[10px] text-dark-600 mt-1">Upload documents to give the AI permanent knowledge.</p>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
              <div
                className="flex items-start gap-2 p-3 cursor-pointer hover:bg-dark-750"
                onClick={() => setExpanded(p => ({ ...p, [doc.id]: !p[doc.id] }))}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium text-dark-100 truncate">{doc.name}</p>
                    <TrainingStatusBadge status={doc.status} />
                  </div>
                  <p className="text-[10px] text-dark-500">{doc.original_filename}</p>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {doc.tags.map(t => (
                        <span key={t} className="text-[9px] bg-dark-700 text-dark-400 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.name); }}
                    className="text-dark-500 hover:text-red-400 transition-colors p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {expanded[doc.id]
                    ? <ChevronDown className="w-3 h-3 text-dark-500" />
                    : <ChevronRight className="w-3 h-3 text-dark-500" />
                  }
                </div>
              </div>

              {/* Expanded: summary and key facts */}
              <AnimatePresence>
                {expanded[doc.id] && doc.status === 'completed' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-dark-700"
                  >
                    <div className="p-3 space-y-2">
                      {doc.summary && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-dark-500 mb-1">Summary</p>
                          <p className="text-[11px] text-dark-300 leading-relaxed">{doc.summary}</p>
                        </div>
                      )}
                      {doc.key_facts && doc.key_facts.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-dark-500 mb-1">Key Facts ({doc.key_facts.length})</p>
                          <ul className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                            {doc.key_facts.map((fact, i) => (
                              <li key={i} className="text-[11px] text-dark-300 flex items-start gap-1">
                                <span className="text-dark-600 flex-shrink-0 mt-0.5">·</span>
                                {fact}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {doc.structured_data && doc.structured_data.trim() && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-dark-500 mb-1">Structured Data</p>
                          <pre className="text-[10px] text-dark-300 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto bg-dark-800 rounded p-2 border border-dark-700">
                            {doc.structured_data}
                          </pre>
                        </div>
                      )}
                      {doc.error_message && (
                        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                          <p className="text-[11px] text-red-400">{doc.error_message}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Full-Screen Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [rightPanel, setRightPanel] = useState(isMobile ? null : 'memory');
  const messagesEndRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
      setRightPanel(null);
    } else {
      setShowSidebar(true);
    }
  }, [isMobile]);

  const {
    sessions,
    currentSessionId,
    openChat,
    closeChat,
    messages,
    isStreaming,
    streamingState,
    pendingFiles,
    isLoadingChat,
    hasMoreMessages,
    isLoadingOlder,
    interrupt,
    sendMessage,
    redoMessage,
    retryMessage,
    uploadFile,
    removePendingFile,
    switchSession,
    newChat,
    setSessions,
    loadOlderMessages,
    setOnSessionCreated,
    mode,
    model,
    setMode,
    setModel,
  } = useAIChat();

  const location = useLocation();

  useEffect(() => {
    openChat();
  }, [openChat]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    const hadChatId = Boolean(prevChatIdRef.current);
    prevChatIdRef.current = chatId;
    if (!chatId || chatId === '') {
      if (!currentSessionId || hadChatId) newChat();
    } else {
      switchSession(chatId);
    }
  }, [chatId, currentSessionId, newChat, switchSession]);

  useEffect(() => {
    setOnSessionCreated((id) => {
      if (location.pathname === '/admin/ai' || location.pathname === '/admin/ai/') {
        navigate(`/admin/ai/${id}`, { replace: true });
      }
    });
    return () => setOnSessionCreated(null);
  }, [location.pathname, navigate, setOnSessionCreated]);

  const handleNewChat = useCallback(() => {
    navigate('/admin/ai');
  }, [navigate]);

  const handleDeleteSession = useCallback((sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (sessionId === currentSessionId) handleNewChat();
  }, [currentSessionId, handleNewChat, setSessions]);

  const handleUpdateSession = useCallback((sessionId, updates) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  }, [setSessions]);

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-900 overflow-hidden">
      {/* iOS safe-area top spacer — only occupies space in standalone on notched devices */}
      <div className="pt-safe bg-dark-800 flex-shrink-0" />
      <div className="flex flex-1 overflow-hidden">
      {showSidebar && isMobile && (
        <div
          className="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onClick={() => setShowSidebar(false)}
          aria-hidden
        />
      )}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: isMobile ? '100%' : 224 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed sm:relative inset-y-0 left-0 z-30 sm:z-auto flex-shrink-0 overflow-hidden bg-dark-900 sm:bg-transparent pt-safe sm:pt-0"
          >
            <AIChatSidebar
              sessions={sessions}
              currentSessionId={chatId || null}
              onSelect={(id) => {
                navigate(`/admin/ai/${id}`);
                if (isMobile) setShowSidebar(false);
              }}
              onNew={() => {
                handleNewChat();
                if (isMobile) setShowSidebar(false);
              }}
              onDelete={handleDeleteSession}
              onUpdate={handleUpdateSession}
              onClose={isMobile ? () => setShowSidebar(false) : undefined}
              showCloseButton={isMobile}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-dark-700 bg-dark-800 flex-shrink-0 gap-2 min-w-0">
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="hidden sm:flex items-center gap-1.5 text-dark-400 hover:text-dark-100 transition-colors p-2 -m-2 rounded-lg hover:bg-dark-700 touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center justify-center p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors touch-manipulation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-dark-700 flex items-center justify-center p-1.5 flex-shrink-0">
                <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-dark-50 truncate">EagleChair AI</h1>
                <p className="text-[10px] text-dark-400 truncate">
                  {isStreaming ? (
                    <span className="text-chat-accent">Responding...</span>
                  ) : 'Powered by Gemini'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <button
              onClick={() => setRightPanel(rightPanel === 'memory' ? null : 'memory')}
              className={`flex items-center justify-center sm:gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation ${
                rightPanel === 'memory'
                  ? 'bg-chat-selected border border-chat-selected-border text-chat-selected-text'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-700'
              }`}
            >
              <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Memory</span>
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'training' ? null : 'training')}
              className={`flex items-center justify-center sm:gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation ${
                rightPanel === 'training'
                  ? 'bg-chat-training/20 border border-chat-training/50 text-chat-training'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-700'
              }`}
            >
              <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Training</span>
            </button>
            <button
              onClick={() => { closeChat(); navigate('/admin/dashboard'); }}
              className="flex items-center justify-center sm:gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors touch-manipulation"
            >
              <Minimize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {isLoadingChat ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px]">
                  <Loader2 className="w-10 h-10 animate-spin text-chat-accent" />
                  <p className="text-sm text-dark-400 mt-4">Loading chat...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto px-3 sm:px-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-dark-800 flex items-center justify-center mb-4 sm:mb-5 shadow-xl p-3">
                    <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
                  </div>
                  <h2 className="text-sm sm:text-base md:text-xl font-bold text-dark-50 mb-1.5 sm:mb-3">EagleChair AI Assistant</h2>
                  <p className="text-[11px] sm:text-xs text-dark-400 leading-relaxed mb-3 sm:mb-6">
                    Ask about quotes, pricing, products, competitors, or upload documents for analysis.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 w-full">
                    {[
                      'Top-selling products this month',
                      'Office chair market trends 2025',
                      'Calculate pricing with 15% margin',
                      'Compare finishes with competitors',
                      'Summarize attached pricing sheet',
                      'Companies with outstanding quotes',
                    ].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-left text-[11px] sm:text-xs bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-dark-600 rounded-xl p-2 sm:p-3 text-dark-300 hover:text-dark-100 transition-colors leading-snug touch-manipulation"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ChatMessageList
                  messages={messages}
                  streamingState={streamingState}
                  hasMoreMessages={hasMoreMessages}
                  isLoadingOlder={isLoadingOlder}
                  onLoadOlder={loadOlderMessages}
                  messagesEndRef={messagesEndRef}
                  onRedo={redoMessage}
                  onRetry={retryMessage}
                />
              )}
            </div>

            <AIChatInput
              onSend={sendMessage}
              onUpload={uploadFile}
              onStop={interrupt}
              isStreaming={isStreaming}
              pendingFiles={pendingFiles}
              onRemoveFile={removePendingFile}
              placeholder="Ask anything..."
              mode={mode}
              onModeChange={setMode}
              model={model}
              onModelChange={setModel}
            />
          </div>

          {rightPanel && isMobile && (
            <div
              className="fixed inset-0 z-20 bg-black/50 sm:hidden"
              onClick={() => setRightPanel(null)}
              aria-hidden
            />
          )}
          <AnimatePresence>
            {rightPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: isMobile ? '100%' : 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed sm:relative inset-y-0 right-0 z-30 sm:z-auto flex-shrink-0 border-l border-dark-700 overflow-hidden bg-dark-900 sm:bg-transparent pt-safe sm:pt-0"
              >
                {rightPanel === 'memory' ? <MemoryPanel onClose={() => setRightPanel(null)} showClose={isMobile} /> : <TrainingPanel onClose={() => setRightPanel(null)} showClose={isMobile} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </div>
  );
}
