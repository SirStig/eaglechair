/**
 * AI Chat Input
 * Message input with file attachment, send button, mode/model dropdowns
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, X, Loader2, Image, FileText, Table, Square, ChevronDown } from 'lucide-react';

const TOOLTIP_PADDING = 8;
const TOOLTIP_MIN_WIDTH = 200;
const TOOLTIP_MAX_WIDTH = 320;

const MODE_OPTIONS = [
  { value: 'ask', label: 'Ask', tooltip: 'Read-only. Ask questions and get information. No edits or creates.' },
  { value: 'edit', label: 'Edit', tooltip: 'Can suggest edits and create things. Acts like normal.' },
  { value: 'agent', label: 'Agent', tooltip: 'Performs many tasks at once. Batch edits, creates, parallel research.' },
];

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto', tooltip: 'Default model for all tasks.' },
  { value: 'max', label: 'Max', tooltip: 'Tries to imitate Max — different personality but can do all tasks.' },
];

function Tooltip({ children, text, placement = 'top', fullWidth }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof document === 'undefined') return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;

    const tooltipEl = tooltipRef.current;
    const tw = tooltipEl ? Math.min(Math.max(tooltipEl.offsetWidth, TOOLTIP_MIN_WIDTH), TOOLTIP_MAX_WIDTH) : TOOLTIP_MAX_WIDTH;
    const th = tooltipEl ? tooltipEl.offsetHeight : 80;

    let top;
    let left;

    if (placement === 'top') {
      top = trigger.top - th - gap;
      left = trigger.left + trigger.width / 2 - tw / 2;
    } else if (placement === 'bottom') {
      top = trigger.bottom + gap;
      left = trigger.left + trigger.width / 2 - tw / 2;
    } else if (placement === 'right') {
      top = trigger.top + trigger.height / 2 - th / 2;
      left = trigger.right + gap;
    } else {
      top = trigger.top + trigger.height / 2 - th / 2;
      left = trigger.left - tw - gap;
    }

    left = Math.max(TOOLTIP_PADDING, Math.min(vw - tw - TOOLTIP_PADDING, left));
    top = Math.max(TOOLTIP_PADDING, Math.min(vh - th - TOOLTIP_PADDING, top));

    setPos({ top, left });
  }, [placement]);

  useEffect(() => {
    if (!visible || !text) return;
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition);
    });
    return () => cancelAnimationFrame(timer);
  }, [visible, text, updatePosition]);

  return (
    <div
      ref={triggerRef}
      className={`relative ${fullWidth ? 'flex w-full' : 'inline-flex'}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && text && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.08 }}
            className="fixed z-[9999] px-3 py-2 text-[11px] leading-relaxed text-dark-100 bg-dark-700 border border-dark-600 rounded-lg shadow-xl whitespace-normal"
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: TOOLTIP_MIN_WIDTH,
              maxWidth: TOOLTIP_MAX_WIDTH,
              width: 'max-content',
              pointerEvents: 'none',
            }}
          >
            {text}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function SelectDropdown({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative">
      <Tooltip text={selected.tooltip} placement="top">
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className="flex items-center gap-1 bg-transparent border-none text-dark-400 hover:text-dark-200 focus:outline-none focus:ring-0 cursor-pointer py-1 pr-1 min-h-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-[11px]">{selected.label}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-1 z-50 min-w-[140px] py-1 rounded-lg bg-dark-800 border border-dark-600 shadow-xl"
          >
            {options.map((o) => (
              <Tooltip key={o.value} text={o.tooltip} placement="right" fullWidth>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    o.value === value ? 'text-chat-accent bg-dark-700/50' : 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/50'
                  }`}
                >
                  {o.label}
                </button>
              </Tooltip>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FILE_TYPE_ICONS = {
  pdf: <FileText className="w-3 h-3" />,
  csv: <Table className="w-3 h-3" />,
  excel: <Table className="w-3 h-3" />,
  image: <Image className="w-3 h-3" />,
  text: <FileText className="w-3 h-3" />,
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function AIChatInput({
  onSend,
  onUpload,
  onStop,
  isStreaming,
  pendingFiles,
  onRemoveFile,
  disabled,
  placeholder = 'Message AI...',
  mode = 'edit',
  onModeChange,
  model = 'auto',
  onModelChange,
  showModeSelectors = true,
}) {
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    // Auto-grow
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
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

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div
      className="ai-chat-input pt-2 sm:pt-3 border-t border-dark-700 bg-dark-800/50"
      style={{
        paddingLeft: 'calc(0.5rem + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(0.5rem + env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map(f => (
            <div
              key={f.file_id}
              className="flex items-center gap-1.5 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-xs group"
            >
              <span className="text-dark-400">
                {FILE_TYPE_ICONS[f.file_type] || <FileText className="w-3 h-3" />}
              </span>
              <span className="text-dark-200 max-w-[80px] sm:max-w-[100px] truncate">{f.filename}</span>
              {f.file_size && (
                <span className="text-dark-500">{formatFileSize(f.file_size)}</span>
              )}
              <button
                onClick={() => onRemoveFile(f.file_id)}
                className="text-dark-500 hover:text-red-400 transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-xs text-red-400 mb-2">{uploadError}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            title="Attach file (PDF, CSV, image, etc.)"
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

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={isStreaming ? 'AI is responding...' : placeholder}
              rows={1}
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-dark-50 placeholder-dark-400 resize-none focus:outline-none focus:border-chat-focus focus:ring-1 focus:ring-chat-focus/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed leading-snug min-h-[44px]"
              style={{ maxHeight: '160px', fontSize: '16px' }}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={onStop}
              disabled={disabled}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!input.trim() && pendingFiles.length === 0) || disabled}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-chat-button hover:bg-chat-button-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {showModeSelectors && (
          <div className="flex items-center gap-4 text-[11px] text-dark-400">
            <SelectDropdown
              options={MODE_OPTIONS}
              value={mode}
              onChange={onModeChange}
              disabled={disabled}
            />
            <SelectDropdown
              options={MODEL_OPTIONS}
              value={model}
              onChange={onModelChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      <p className="text-[10px] text-dark-500 mt-1.5 text-center hidden sm:block">
        Enter to send · Shift+Enter for new line · Drag & drop files
      </p>
    </div>
  );
}
