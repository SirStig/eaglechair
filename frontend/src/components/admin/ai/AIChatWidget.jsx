/**
 * AI Chat Widget
 * Floating chat panel that hovers over admin pages.
 * Shows as a compact panel or full-screen mode.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, ChevronLeft, MessageSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAIChat } from '../../../contexts/AIChatContext';
import AIChatInput from './AIChatInput';
import AIChatSidebar from './AIChatSidebar';
import ChatMessageList from './ChatMessageList';
import SuggestedEditsBar from './SuggestedEditsBar';

function WelcomeScreen({ onSuggestionClick }) {
  const suggestions = [
    'Analyze quote trends',
    'Research competitor pricing',
    'Calculate margins',
    'Summarize pricing sheet',
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-dark-800 flex items-center justify-center mb-3 shadow-lg p-2">
        <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
      </div>
      <h3 className="text-xs sm:text-sm font-bold text-dark-50 mb-1.5">EagleChair AI Assistant</h3>
      <p className="text-[11px] sm:text-xs text-dark-400 leading-relaxed max-w-xs">
        Ask about quotes, pricing, products, and more.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-4 w-full max-w-xs">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick?.(suggestion)}
            className="text-left text-[11px] sm:text-xs bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-dark-600 rounded-xl p-2 text-dark-300 hover:text-dark-100 transition-colors leading-tight"
          >
            {suggestion}
          </button>
        ))}
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
    toggleFullScreen,
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
      <motion.div
        key="chat-widget"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`
          fixed z-[999] bg-dark-850 border border-dark-700 shadow-2xl flex flex-col overflow-hidden
          ${isFullScreen
            ? 'inset-0 rounded-none'
            : 'left-2 right-2 top-2 bottom-2 sm:left-auto sm:right-6 sm:top-auto sm:bottom-20 sm:w-[420px] rounded-2xl h-[calc(100dvh-1rem)] sm:h-[600px]'
          }
        `}
        style={{ '--tw-bg-opacity': '1', backgroundColor: 'rgb(15 17 23 / var(--tw-bg-opacity))' }}
      >
        {/* Safe-area top spacer — only affects standalone on notched devices in full-screen */}
        {isFullScreen && <div className="pt-safe bg-dark-800 flex-shrink-0" />}

        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-dark-700 bg-dark-800/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
              title="Chat history"
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${showSidebar ? '' : 'rotate-180'}`} />
            </button>
            <div className="w-7 h-7 rounded-lg bg-dark-700 flex items-center justify-center p-1">
              <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-dark-50 leading-none">Eagle AI</p>
              <p className="text-[10px] text-dark-400 mt-0.5">
                {isStreaming ? (
                  <span className="text-chat-accent flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-chat-accent animate-pulse inline-block" />
                    Responding...
                  </span>
                ) : 'Ready'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenFullScreen}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
              title="Open full screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={closeChat}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden relative">
          {showSidebar && isMobile && (
            <div
              className="absolute inset-0 z-10 bg-black/50 sm:hidden"
              onClick={() => setShowSidebar(false)}
              aria-hidden
            />
          )}
          <AnimatePresence>
            {showSidebar && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: isMobile ? '100%' : 208, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute sm:relative inset-y-0 left-0 z-20 w-full sm:w-[224px] sm:max-w-none overflow-hidden flex-shrink-0 sm:bg-transparent"
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {isLoadingChat ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                  <Loader2 className="w-8 h-8 animate-spin text-chat-accent" />
                  <p className="text-xs text-dark-400 mt-3">Loading chat...</p>
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
            />
            {/* Safe-area bottom spacer in full-screen standalone */}
            {isFullScreen && <div className="pb-safe flex-shrink-0" />}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

