import { useRef, useCallback, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Loader2 } from 'lucide-react';
import AIChatMessage from './AIChatMessage';
import AIChatStreamStatus from './AIChatStreamStatus';

export default function ChatMessageList({
  messages,
  streamingState,
  hasMoreMessages,
  isLoadingOlder,
  onLoadOlder,
  messagesEndRef,
  compact = false,
  onRedo,
  onRetry,
}) {
  const px = compact ? 'px-2 sm:px-3' : 'px-3 sm:px-6';
  const pt = compact ? 'pt-2 sm:pt-3' : 'pt-4 sm:pt-6';
  const loadOlderTriggered = useRef(false);
  useEffect(() => {
    if (!isLoadingOlder) loadOlderTriggered.current = false;
  }, [isLoadingOlder]);

  const handleStartReached = useCallback(() => {
    if (hasMoreMessages && !isLoadingOlder && messages.length > 0 && !loadOlderTriggered.current) {
      loadOlderTriggered.current = true;
      onLoadOlder?.();
    }
  }, [hasMoreMessages, isLoadingOlder, messages.length, onLoadOlder]);

  if (!messages?.length) return null;

  return (
    <div className="flex-1 min-h-0">
      <Virtuoso
        data={messages}
        className="h-full"
        style={{ height: '100%' }}
        followOutput="smooth"
        alignToBottom
        startReached={handleStartReached}
        itemContent={(index, msg) => (
          <div className={`[content-visibility:auto] ${px} ${index === 0 ? pt : ''}`}>
            <AIChatMessage message={msg} onRedo={onRedo} onRetry={onRetry} />
          </div>
        )}
        components={{
          Header: () =>
            hasMoreMessages ? (
              <div className={`flex justify-center py-3 ${px}`}>
                {isLoadingOlder ? (
                  <Loader2 className="w-5 h-5 animate-spin text-chat-accent" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      loadOlderTriggered.current = true;
                      onLoadOlder?.();
                    }}
                    className="text-xs text-dark-400 hover:text-chat-accent transition-colors"
                  >
                    Load older messages
                  </button>
                )}
              </div>
            ) : null,
          Footer: () => (
            <div className={`${px} pb-2`}>
              {streamingState && <AIChatStreamStatus state={streamingState} />}
              <div ref={messagesEndRef} />
            </div>
          ),
        }}
      />
    </div>
  );
}
