import { useRef, useCallback, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Loader2 } from 'lucide-react';
import AIChatMessage from './AIChatMessage';
import AIChatStreamStatus from './AIChatStreamStatus';

const VIRTUALIZE_THRESHOLD = 25;

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

  const useVirtualization = messages.length >= VIRTUALIZE_THRESHOLD;

  if (!useVirtualization) {
    return (
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth ${px} ${pt} pb-2`}>
        {hasMoreMessages && (
          <div className="flex justify-center py-3">
            {isLoadingOlder ? (
              <Loader2 className="w-5 h-5 animate-spin text-chat-accent" />
            ) : (
              <button
                type="button"
                onClick={onLoadOlder}
                className="text-xs text-dark-400 hover:text-chat-accent transition-colors"
              >
                Load older messages
              </button>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="[content-visibility:auto]">
            <AIChatMessage message={msg} onRedo={onRedo} onRetry={onRetry} />
          </div>
        ))}
        {streamingState && <AIChatStreamStatus state={streamingState} />}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <Virtuoso
        data={messages}
        className="flex-1 min-h-0"
        style={{ minHeight: 0 }}
        followOutput="smooth"
        alignToBottom
        startReached={handleStartReached}
        itemContent={(index, msg) => (
          <div className={`${px} ${index === 0 ? pt : 'pt-1'}`}>
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
