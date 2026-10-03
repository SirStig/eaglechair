/**
 * AI Chat Full-Screen Page
 * Full-screen chat experience at /admin/ai
 * Includes memory management and training document panel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Brain,
  BookOpen,
  PanelLeft,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  ChevronRight,
  Loader2,
  Database,
  X,
  Search,
  Globe,
  Calculator,
  Palette,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useAIChat } from '../../contexts/AIChatContext';
import AIChatInput from '../../components/admin/ai/AIChatInput';
import AIChatSidebar from '../../components/admin/ai/AIChatSidebar';
import AIMark from '../../components/admin/ai/AIMark';
import ChatMessageList from '../../components/admin/ai/ChatMessageList';
import SuggestedEditsBar from '../../components/admin/ai/SuggestedEditsBar';
import {
  getMemory,
  deleteMemory,
  listTrainingDocs,
  uploadTrainingDoc,
  uploadTrainingBatch,
  deleteTrainingDoc,
} from '../../services/aiChatService';

const SUGGESTIONS = [
  { icon: Layers, title: 'Catalog overview', detail: 'Families and how many products each has', prompt: 'Give me an overview of our product families and how many active products are in each' },
  { icon: ShieldCheck, title: 'Audit product data', detail: 'Duplicate SKUs, missing images, messy names', prompt: 'Audit our products for data quality issues like duplicate SKUs, missing images or missing descriptions' },
  { icon: Palette, title: 'Unused finishes & fabrics', detail: 'Options no product is using', prompt: 'Which finishes and fabrics are not used by any product?' },
  { icon: FileSpreadsheet, title: 'Price list vs catalog', detail: 'Models in our documents but not on the site', prompt: 'Which model numbers are in the training documents but missing from the live catalog?' },
  { icon: Calculator, title: 'Pricing math', detail: 'Markup and margin on a list price', prompt: 'What is a 15% markup on a $385 chair, and what margin does that give us?' },
  { icon: Globe, title: 'Competitor research', detail: 'Look up competitor pricing online', prompt: 'Research what competitors charge for commercial restaurant chairs' },
];

const INPUT_CLASS =
  'w-full h-9 bg-transparent border border-chat-line rounded-lg px-3 text-[13px] text-chat-text placeholder-chat-faint focus:outline-none focus:border-chat-line-strong focus:bg-white/[0.02]';

// ─────────────────────────────────────────────────────────────────────────────
// Right Panel: Memory & Training
// ─────────────────────────────────────────────────────────────────────────────

function IconButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-chat-muted hover:text-chat-text hover:bg-white/[0.06] transition-colors touch-manipulation"
    >
      {children}
    </button>
  );
}

function PanelHeader({ title, count, children }) {
  return (
    <div className="flex items-center justify-between gap-2 h-14 px-4 border-b border-chat-line flex-shrink-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 className="!text-sm font-semibold text-chat-text">{title}</h3>
        <span className="text-xs text-chat-faint tabular-nums">{count}</span>
      </div>
      <div className="flex items-center gap-0.5 -mr-1.5">{children}</div>
    </div>
  );
}

function PanelEmpty({ icon: Icon, title, detail }) {
  return (
    <div className="text-center py-12 px-6">
      <Icon className="w-5 h-5 text-chat-faint mx-auto mb-2.5" />
      <p className="text-[13px] text-chat-muted">{title}</p>
      {detail && <p className="text-xs text-chat-faint mt-1 leading-relaxed">{detail}</p>}
    </div>
  );
}

function importanceLabel(value) {
  if (value >= 0.7) return 'High';
  if (value >= 0.4) return 'Medium';
  return 'Low';
}

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
      <PanelHeader title="Memory" count={memories.length}>
        <IconButton onClick={load} title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </IconButton>
        {showClose && (
          <IconButton onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </IconButton>
        )}
      </PanelHeader>

      <div className="p-3 border-b border-chat-line flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-chat-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search memory"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT_CLASS} pl-8`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-4 h-4 animate-spin text-chat-faint" />
          </div>
        ) : filtered.length === 0 ? (
          <PanelEmpty
            icon={Brain}
            title={memories.length === 0 ? 'No memories yet' : 'No matches'}
            detail={memories.length === 0 ? 'As you chat, the assistant remembers important facts here.' : null}
          />
        ) : (
          categories.map(cat => (
            <div key={cat}>
              <p className="text-[11px] font-medium text-chat-faint px-1 pt-4 pb-1.5 capitalize">{cat}</p>
              <div className="space-y-1.5">
                {filtered.filter(m => m.category === cat).map(m => (
                  <div key={m.key} className="group rounded-lg border border-chat-line bg-chat-raised/60 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-chat-text min-w-0">{m.key}</p>
                      <button
                        onClick={() => handleDelete(m.key)}
                        className="flex-shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-chat-faint hover:text-red-400 hover:bg-white/[0.05] transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                        title="Delete memory"
                        aria-label={`Delete memory ${m.key}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[13px] text-chat-muted leading-relaxed mt-0.5">{m.value}</p>
                    {typeof m.importance === 'number' && (
                      <p className="text-[11px] text-chat-faint mt-1.5">
                        {importanceLabel(m.importance)} importance
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TrainingStatusBadge({ status }) {
  const config = {
    pending: { dot: 'bg-chat-faint', text: 'text-chat-faint', label: 'Queued' },
    processing: { dot: 'bg-chat-accent animate-pulse', text: 'text-chat-accent', label: 'Processing' },
    completed: { dot: 'bg-chat-status-success', text: 'text-chat-muted', label: 'Ready' },
    failed: { dot: 'bg-red-400', text: 'text-red-400', label: 'Failed' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] flex-shrink-0 ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
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
      <PanelHeader title="Training" count={docs.length}>
        <IconButton onClick={() => load()} title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </IconButton>
        <button
          type="button"
          onClick={() => setShowUpload(!showUpload)}
          className="h-8 ml-1 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-chat-line-strong bg-chat-raised hover:bg-white/[0.06] text-[13px] font-medium text-chat-text transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
        {showClose && (
          <IconButton onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </IconButton>
        )}
      </PanelHeader>

      {/* Upload form */}
      <AnimatePresence>
        {showUpload && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-chat-line flex-shrink-0"
          >
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-chat-text">Add training document</p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={batchMode}
                    onChange={e => { setBatchMode(e.target.checked); setSelectedFile(null); setSelectedFiles([]); }}
                    className="rounded border-chat-line-strong bg-transparent text-chat-accent focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-chat-muted">Batch upload</span>
                </label>
              </div>
              {!batchMode && (
                <>
                  <input
                    type="text"
                    placeholder="Document name"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="text"
                    placeholder="Tags, comma-separated (optional)"
                    value={form.tags}
                    onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => batchMode ? batchInputRef.current?.click() : fileInputRef.current?.click()}
                className="w-full border border-dashed border-chat-line-strong hover:border-chat-faint hover:bg-white/[0.02] rounded-lg px-3 py-4 text-center transition-colors"
              >
                <Upload className="w-4 h-4 text-chat-muted mx-auto mb-1.5" />
                {batchMode ? (
                  selectedFiles.length > 0 ? (
                    <p className="text-[13px] text-chat-text">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</p>
                  ) : (
                    <p className="text-[13px] text-chat-muted">Choose files</p>
                  )
                ) : selectedFile ? (
                  <p className="text-[13px] text-chat-text truncate">{selectedFile.name}</p>
                ) : (
                  <p className="text-[13px] text-chat-muted">Choose a file</p>
                )}
                <p className="text-[11px] text-chat-faint mt-0.5">PDF, CSV, Excel, TXT or Markdown{batchMode ? ' · names come from file names' : ''}</p>
              </button>
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
              <div className="flex justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setUploadError(null); }}
                  className="h-8 px-3 rounded-lg text-[13px] font-medium text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:opacity-60"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {uploading ? (
                    uploadProgress ? `Batch ${uploadProgress.batch}/${uploadProgress.totalBatches}…` : 'Uploading…'
                  ) : batchMode ? (
                    `Upload ${selectedFiles.length || 0} & train`
                  ) : (
                    'Upload & train'
                  )}
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Docs list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-4 h-4 animate-spin text-chat-faint" />
          </div>
        ) : docs.length === 0 ? (
          <PanelEmpty
            icon={Database}
            title="No training documents"
            detail="Upload price lists, spec sheets and guides to give the assistant permanent knowledge."
          />
        ) : (
          docs.map(doc => {
            const canExpand = doc.status === 'completed' || Boolean(doc.error_message);
            const isOpen = expanded[doc.id] && canExpand;
            return (
              <div key={doc.id} className="group rounded-lg border border-chat-line bg-chat-raised/60 overflow-hidden">
                <div
                  className={`flex items-start gap-2 px-3 py-2.5 ${canExpand ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
                  onClick={() => canExpand && setExpanded(p => ({ ...p, [doc.id]: !p[doc.id] }))}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-chat-text truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                      <TrainingStatusBadge status={doc.status} />
                      <span className="text-[11px] text-chat-faint truncate">{doc.original_filename}</span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {doc.tags.map(t => (
                          <span key={t} className="text-[11px] text-chat-muted bg-white/[0.05] rounded px-1.5 py-0.5">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.name); }}
                      className="p-1 rounded-md text-chat-faint hover:text-red-400 hover:bg-white/[0.05] transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      title="Remove document"
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {canExpand && (
                      <ChevronRight className={`w-3.5 h-3.5 text-chat-faint transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    )}
                  </div>
                </div>

                {/* Expanded: summary and key facts */}
                <AnimatePresence>
                  {isOpen && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-chat-line"
                    >
                      <div className="p-3 space-y-3">
                        {doc.summary && (
                          <div>
                            <p className="text-[11px] font-medium text-chat-faint mb-1">Summary</p>
                            <p className="text-xs text-chat-muted leading-relaxed">{doc.summary}</p>
                          </div>
                        )}
                        {doc.key_facts && doc.key_facts.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium text-chat-faint mb-1">Key facts · {doc.key_facts.length}</p>
                            <ul className="list-disc pl-4 space-y-0.5 max-h-48 overflow-y-auto pr-1 marker:text-chat-faint">
                              {doc.key_facts.map((fact, i) => (
                                <li key={i} className="text-xs text-chat-muted leading-relaxed">{fact}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {doc.structured_data && doc.structured_data.trim() && (
                          <div>
                            <p className="text-[11px] font-medium text-chat-faint mb-1">Structured data</p>
                            <pre className="text-[11px] text-chat-muted whitespace-pre-wrap font-mono max-h-64 overflow-y-auto bg-dark-950 rounded-md p-2.5 border border-chat-line">
                              {doc.structured_data}
                            </pre>
                          </div>
                        )}
                        {doc.error_message && (
                          <p className="text-xs text-red-300 rounded-md border border-red-500/25 bg-red-500/[0.06] px-2.5 py-2">{doc.error_message}</p>
                        )}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HeaderToggle({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`h-8 inline-flex items-center justify-center gap-1.5 px-2 sm:px-2.5 rounded-lg text-[13px] font-medium transition-colors touch-manipulation ${
        active
          ? 'bg-white/[0.08] text-chat-text'
          : 'text-chat-muted hover:text-chat-text hover:bg-white/[0.05]'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function EmptyState({ onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <AIMark size="lg" className="mb-5" />
        <h2 className="!text-xl sm:!text-2xl font-semibold text-chat-text tracking-tight text-center">
          How can I help today?
        </h2>
        <p className="text-sm text-chat-muted mt-2 text-center max-w-md leading-relaxed">
          Ask about quotes, pricing, products and competitors, or attach a document to analyze.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-8">
          {SUGGESTIONS.map(({ icon: Icon, title, detail, prompt }) => (
            <button
              key={title}
              type="button"
              onClick={() => onSelect(prompt)}
              className="group flex items-start gap-3 text-left rounded-xl border border-chat-line bg-chat-surface hover:bg-chat-raised hover:border-chat-line-strong px-3.5 py-3 transition-colors touch-manipulation"
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-chat-faint group-hover:text-chat-accent transition-colors" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-chat-text">{title}</span>
                <span className="block text-xs text-chat-muted mt-0.5">{detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Full-Screen Page
// ─────────────────────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 264;
const PANEL_WIDTH = 340;

export default function AIChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isNarrow = useMediaQuery('(max-width: 1279px)');
  const [rightPanel, setRightPanel] = useState(null);
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
    markEditApplied,
    markEditDeclined,
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

  const togglePanel = (panel) => setRightPanel(rightPanel === panel ? null : panel);

  const currentTitle = chatId ? sessions.find(s => s.id === chatId)?.title : null;
  // The side panel overlays the chat on narrower screens so messages keep their width
  const panelOverlays = isMobile || isNarrow;

  return (
    <div className="ai-chat flex flex-col h-[100dvh] bg-dark-900 overflow-hidden">
      {/* iOS safe-area top spacer — only occupies space in standalone on notched devices */}
      <div className="pt-safe bg-dark-900 flex-shrink-0" />
      <div className="flex flex-1 overflow-hidden relative">
        {showSidebar && isMobile && (
          <div
            className="fixed inset-0 z-20 bg-black/60 sm:hidden"
            onClick={() => setShowSidebar(false)}
            aria-hidden
          />
        )}
        <AnimatePresence initial={false}>
          {showSidebar && (
            <m.div
              initial={{ width: 0 }}
              animate={{ width: isMobile ? '100%' : SIDEBAR_WIDTH }}
              exit={{ width: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed sm:relative inset-y-0 left-0 z-30 sm:z-auto flex-shrink-0 overflow-hidden pt-safe sm:pt-0"
            >
              <div className="h-full" style={{ width: isMobile ? '100vw' : SIDEBAR_WIDTH }}>
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
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Main chat */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between h-14 px-2 sm:px-3 border-b border-chat-line flex-shrink-0 gap-2 min-w-0">
            <div className="flex items-center gap-0.5 min-w-0">
              <IconButton onClick={() => { closeChat(); navigate('/admin/dashboard'); }} title="Back to dashboard">
                <ArrowLeft className="w-4 h-4" />
              </IconButton>
              <IconButton onClick={() => setShowSidebar(!showSidebar)} title={showSidebar ? 'Hide chats' : 'Show chats'}>
                <PanelLeft className="w-4 h-4" />
              </IconButton>
              <div className="w-px h-5 bg-chat-line mx-1.5 hidden sm:block" />
              <div className="min-w-0 pl-1 sm:pl-0">
                <h1 className="!text-sm font-semibold text-chat-text truncate leading-tight">
                  {currentTitle || 'Eagle AI'}
                </h1>
                <p className="text-[11px] text-chat-faint truncate leading-tight mt-0.5">
                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1.5 text-chat-accent">
                      <span className="w-1.5 h-1.5 rounded-full bg-chat-accent animate-pulse" />
                      Responding
                    </span>
                  ) : currentTitle ? 'Eagle AI' : 'Admin assistant'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <HeaderToggle active={rightPanel === 'memory'} onClick={() => togglePanel('memory')} icon={Brain} label="Memory" />
              <HeaderToggle active={rightPanel === 'training'} onClick={() => togglePanel('training')} icon={BookOpen} label="Training" />
              <div className="w-px h-5 bg-chat-line mx-1" />
              <IconButton onClick={handleNewChat} title="New chat">
                <Plus className="w-4 h-4" />
              </IconButton>
            </div>
          </header>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-w-0 relative">
            {/* Messages */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {isLoadingChat ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-chat-faint" />
                    <p className="text-[13px] text-chat-muted mt-3">Loading conversation…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState onSelect={(s) => sendMessage(s)} />
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
                    onEditApplied={markEditApplied}
                    onEditDeclined={markEditDeclined}
                  />
                )}
              </div>

              <SuggestedEditsBar
                messages={messages}
                onEditApplied={markEditApplied}
                onEditDeclined={markEditDeclined}
              />

              <AIChatInput
                onSend={sendMessage}
                onUpload={uploadFile}
                onStop={interrupt}
                isStreaming={isStreaming}
                pendingFiles={pendingFiles}
                onRemoveFile={removePendingFile}
                mode={mode}
                onModeChange={setMode}
                model={model}
                onModelChange={setModel}
              />
            </div>

            {rightPanel && panelOverlays && (
              <div
                className={`${isMobile ? 'fixed' : 'absolute'} inset-0 z-20 bg-black/50`}
                onClick={() => setRightPanel(null)}
                aria-hidden
              />
            )}
            <AnimatePresence initial={false}>
              {rightPanel && (
                <m.aside
                  initial={panelOverlays ? { x: 24, opacity: 0 } : { width: 0, opacity: 0 }}
                  animate={panelOverlays ? { x: 0, opacity: 1 } : { width: PANEL_WIDTH, opacity: 1 }}
                  exit={panelOverlays ? { x: 24, opacity: 0 } : { width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`${
                    isMobile
                      ? 'fixed inset-0 z-30 pt-safe'
                      : panelOverlays
                        ? 'absolute inset-y-0 right-0 z-30 shadow-2xl shadow-black/60'
                        : 'relative'
                  } flex-shrink-0 overflow-hidden border-l border-chat-line bg-chat-surface`}
                  style={!isMobile && panelOverlays ? { width: PANEL_WIDTH } : undefined}
                >
                  <div className="h-full" style={{ width: isMobile ? '100%' : PANEL_WIDTH }}>
                    {rightPanel === 'memory'
                      ? <MemoryPanel onClose={() => setRightPanel(null)} showClose={panelOverlays} />
                      : <TrainingPanel onClose={() => setRightPanel(null)} showClose={panelOverlays} />}
                  </div>
                </m.aside>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
