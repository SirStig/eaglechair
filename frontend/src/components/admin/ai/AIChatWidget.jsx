/**
 * AI Chat Widget
 * Floating chat panel that hovers over admin pages.
 * Shows as a compact panel or full-screen mode.
 */

import { useRef, useCallback, useState } from 'react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { m, AnimatePresence } from 'framer-motion';
import { X, Maximize2, PanelLeft, Plus, Loader2, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAIChat } from '../../../contexts/AIChatContext';
import AIChatInput from './AIChatInput';
import AIChatSidebar from './AIChatSidebar';
import ChatMessageList from './ChatMessageList';
import SuggestedEditsBar from './SuggestedEditsBar';
import AIMark from './AIMark';

function WelcomeScreen({ onSuggestionClick }) {
  const suggestions = [
    'Give me an overview of our product families',
    'Audit our products for data quality issues',
    'Which finishes and fabrics are unused?',
    'Research competitor pricing',
  ];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col justify-end px-4 pb-4 pt-8">
        <AIMark size="md" className="mb-4" />
        <h3 className="!text-base font-semibold text-chat-text">How can I help?</h3>
        <p className="text-[13px] text-chat-muted leading-relaxed mt-1">
          Ask about products, catalog data, pricing math and competitors. Answers here are read-only.
        </p>
        <div className="mt-4 rounded-xl border border-chat-line divide-y divide-chat-line overflow-hidden">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="group w-full flex items-center justify-between gap-2 text-left px-3.5 py-2.5 text-[13px] text-chat-text hover:bg-white/[0.03] transition-colors"
            >
              {suggestion}
              <ArrowUpRight className="w-3.5 h-3.5 text-chat-faint group-hover:text-chat-accent transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIChatWidget() {
  const navigate = useNavigate();
  const {
    isOpen,
    isFullScreen,
    closeChat,
    sessions,
    currentSessionId,
    messages,
    isStreaming,
    streamingState,
    pendingFiles,
    isLoadingChat,
    hasMoreMessages,
    isLoadingOlder,
    interrupt,
    sendMessage: sendMessageRaw,
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
  } = useAIChat();

  const sendMessage = useCallback((content, fileIds = [], opts = {}) => {
    sendMessageRaw(content, fileIds, { ...opts, mode: 'ask' });
  }, [sendMessageRaw]);

  const messagesEndRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobile = useMediaQuery('(max-width: 639px)');

  const handleOpenFullScreen = () => {
    navigate(currentSessionId ? `/admin/ai/${currentSessionId}` : '/admin/ai');
  };

  const handleDeleteSession = useCallback((sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (sessionId === currentSessionId) {
      newChat();
    }
  }, [currentSessionId, newChat, setSessions]);

  const handleUpdateSession = useCallback((sessionId, updates) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  }, [setSessions]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <m.div
        key="chat-widget"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ transformOrigin: 'bottom right' }}
        className={`
          ai-chat fixed z-[999] bg-dark-900 border border-chat-line-strong shadow-2xl shadow-black/60 flex flex-col overflow-hidden
          ${isFullScreen
            ? 'inset-0 rounded-none'
            : 'left-2 right-2 top-2 bottom-2 sm:left-auto sm:right-6 sm:top-auto sm:bottom-24 sm:w-[420px] rounded-2xl h-[calc(100dvh-1rem)] sm:h-[min(640px,calc(100dvh-8rem))]'
          }
        `}
      >
        {/* Safe-area top spacer — only affects standalone on notched devices in full-screen */}
        {isFullScreen && <div className="pt-safe flex-shrink-0" />}

        {/* Header */}
        <div className="flex items-center justify-between h-14 pl-2 pr-2 border-b border-chat-line flex-shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            <HeaderButton onClick={() => setShowSidebar(!showSidebar)} title={showSidebar ? 'Hide chats' : 'Chat history'} active={showSidebar}>
              <PanelLeft className="w-4 h-4" />
            </HeaderButton>
            <div className="flex items-center gap-2.5 min-w-0 pl-1">
              <AIMark size="xs" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-chat-text leading-tight">Eagle AI</p>
                <p className="text-[11px] text-chat-faint leading-tight mt-0.5">
                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1.5 text-chat-accent">
                      <span className="w-1.5 h-1.5 rounded-full bg-chat-accent animate-pulse" />
                      Responding
                    </span>
                  ) : 'Ask mode · read-only'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <HeaderButton onClick={() => { newChat(); setShowSidebar(false); }} title="New chat">
              <Plus className="w-4 h-4" />
            </HeaderButton>
            <HeaderButton onClick={handleOpenFullScreen} title="Open full screen">
              <Maximize2 className="w-3.5 h-3.5" />
            </HeaderButton>
            <HeaderButton onClick={closeChat} title="Close">
              <X className="w-4 h-4" />
            </HeaderButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden relative">
          <AnimatePresence>
            {showSidebar && (
              <>
                <m.div
                  key="scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-10 bg-black/50"
                  onClick={() => setShowSidebar(false)}
                  aria-hidden
                />
                <m.div
                  key="sidebar"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 z-20 w-full sm:w-[272px] shadow-2xl shadow-black/60"
                >
                  <AIChatSidebar
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onSelect={(id) => { switchSession(id); setShowSidebar(false); }}
                    onNew={() => { newChat(); setShowSidebar(false); }}
                    onDelete={handleDeleteSession}
                    onUpdate={handleUpdateSession}
                    onClose={isMobile ? () => setShowSidebar(false) : undefined}
                    showCloseButton={isMobile}
                  />
                </m.div>
              </>
            )}
          </AnimatePresence>

          {/* Chat area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Messages */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {isLoadingChat ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-chat-faint" />
                  <p className="text-[13px] text-chat-muted mt-3">Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <WelcomeScreen onSuggestionClick={sendMessage} />
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
                  compact
                />
              )}
            </div>

            <SuggestedEditsBar
              messages={messages}
              onEditApplied={markEditApplied}
              onEditDeclined={markEditDeclined}
            />

            {/* Input */}
            <AIChatInput
              onSend={sendMessage}
              onUpload={uploadFile}
              onStop={interrupt}
              isStreaming={isStreaming}
              pendingFiles={pendingFiles}
              onRemoveFile={removePendingFile}
              showModeSelectors={false}
              placeholder="Ask Eagle AI…"
            />
            {/* Safe-area bottom spacer in full-screen standalone */}
            {isFullScreen && <div className="pb-safe flex-shrink-0" />}
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}

function HeaderButton({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        active ? 'bg-white/[0.08] text-chat-text' : 'text-chat-muted hover:text-chat-text hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}
