/**
 * AI Chat Input
 * Message input with file attachment, send button, keyboard shortcuts
 */

import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X, Loader2, Image, FileText, Table, Square } from 'lucide-react';

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

      <div className="flex items-center gap-2">
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

      <p className="text-[10px] text-dark-500 mt-1.5 text-center hidden sm:block">
        Enter to send · Shift+Enter for new line · Drag & drop files
      </p>
    </div>
  );
}
