/**
 * AI Chat Input
 * Composer: auto-growing message box with a toolbar for attachments,
 * mode/model selection and send/stop.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ArrowUp, Paperclip, X, Loader2, Image, FileText, Table, Square, ChevronDown, Check } from 'lucide-react';

const MODE_OPTIONS = [
  { value: 'ask', label: 'Ask', description: 'Read-only. Answers questions without making changes.' },
  { value: 'edit', label: 'Edit', description: 'Can suggest edits and create records for you to review.' },
  { value: 'agent', label: 'Agent', description: 'Handles multi-step work: batch edits, creates and research.' },
];

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Balanced default for everyday tasks.' },
  { value: 'deep', label: 'Deep', description: 'More reasoning for complex analysis. Slower.' },
  { value: 'max', label: 'Max', description: 'Responds in Max’s voice. Can do every task.' },
];

function SelectDropdown({ label, options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${label}: ${selected.description}`}
        className={`h-8 inline-flex items-center gap-1 rounded-lg px-2 text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'bg-white/[0.06] text-chat-text' : 'text-chat-muted hover:text-chat-text hover:bg-white/[0.05]'
        }`}
      >
        <span className="text-chat-faint hidden sm:inline">{label}</span>
        <span className="font-medium">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-chat-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute bottom-full left-0 mb-2 z-50 w-[260px] p-1 rounded-xl bg-chat-raised border border-chat-line-strong shadow-2xl shadow-black/50"
          >
            <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-chat-faint">{label}</p>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-start gap-2 text-left px-2.5 py-2 rounded-lg transition-colors ${
                    active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-chat-text">{o.label}</span>
                    <span className="block text-xs leading-snug text-chat-muted mt-0.5">{o.description}</span>
                  </span>
                  <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-chat-accent ${active ? '' : 'invisible'}`} />
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FILE_TYPE_ICONS = {
  pdf: <FileText className="w-3.5 h-3.5" />,
  csv: <Table className="w-3.5 h-3.5" />,
  excel: <Table className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5" />,
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AIChatInput({
  onSend,
  onUpload,
  onStop,
  isStreaming,
  pendingFiles,
  onRemoveFile,
  disabled,
  placeholder = 'Message Eagle AI…',
  mode = 'edit',
  onModeChange,
  model = 'auto',
  onModelChange,
  showModeSelectors = true,
}) {
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const canSend = (input.trim() || pendingFiles.length > 0) && !disabled;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || disabled) return;
    const fileIds = pendingFiles.map(f => f.file_id);
    onSend(text, fileIds);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, pendingFiles, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    // Auto-grow
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of files) {
        await onUpload(file);
      }
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    await uploadFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    await uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };

  return (
    <div
      className="ai-chat-input flex-shrink-0 pt-2"
      style={{
        paddingLeft: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(0.75rem + env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="w-full max-w-3xl mx-auto">
        <div
          className={`rounded-2xl border bg-chat-raised transition-colors shadow-lg shadow-black/20 ${
            isDragging
              ? 'border-chat-accent/60 bg-chat-accent/[0.04]'
              : 'border-chat-line-strong focus-within:border-[#444]'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) textareaRef.current?.focus();
          }}
        >
          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {pendingFiles.map(f => (
                <div
                  key={f.file_id}
                  className="flex items-center gap-2 rounded-lg border border-chat-line-strong bg-chat-surface pl-2 pr-1 py-1 text-xs"
                >
                  <span className="text-chat-muted">
                    {FILE_TYPE_ICONS[f.file_type] || <FileText className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-chat-text max-w-[140px] sm:max-w-[200px] truncate">{f.filename}</span>
                  {f.file_size && (
                    <span className="text-chat-faint">{formatFileSize(f.file_size)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(f.file_id)}
                    className="p-0.5 rounded text-chat-faint hover:text-chat-text hover:bg-white/[0.06] transition-colors"
                    aria-label={`Remove ${f.filename}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={isDragging ? 'Drop files to attach' : placeholder}
            rows={1}
            aria-label="Message"
            className="block w-full bg-transparent border-0 px-4 pt-3.5 pb-1 text-[15px] leading-6 text-chat-text placeholder-chat-faint resize-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '200px' }}
          />

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-chat-muted hover:text-chat-text hover:bg-white/[0.05] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              title="Attach files (PDF, CSV, Excel, images)"
              aria-label="Attach files"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.csv,.xlsx,.xls,.txt,.md,.json,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            {showModeSelectors && (
              <>
                <SelectDropdown label="Mode" options={MODE_OPTIONS} value={mode} onChange={onModeChange} disabled={disabled} />
                <SelectDropdown label="Model" options={MODEL_OPTIONS} value={model} onChange={onModelChange} disabled={disabled} />
              </>
            )}

            <div className="flex-1" />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                disabled={disabled}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-chat-text hover:bg-white text-dark-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-chat-button hover:bg-chat-button-hover text-dark-950 transition-colors disabled:bg-white/[0.08] disabled:text-chat-faint disabled:cursor-not-allowed touch-manipulation"
                title="Send (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {uploadError ? (
          <p className="text-xs text-red-400 mt-2 px-1">{uploadError}</p>
        ) : (
          <p className="text-[11px] text-chat-faint mt-2 text-center hidden sm:block">
            Eagle AI can make mistakes. Review suggested edits before applying them.
          </p>
        )}
      </div>
    </div>
  );
}
