import { useRef, useCallback, useEffect, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Loader2 } from 'lucide-react';
import AIChatMessage from './AIChatMessage';
import AIChatStreamStatus from './AIChatStreamStatus';

const VIRTUALIZE_THRESHOLD = 25;
const NEAR_BOTTOM_THRESHOLD = 150;

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
  onEditApplied,
  onEditDeclined,
}) {
  const px = compact ? 'px-3 sm:px-4' : 'px-4 sm:px-6';
  const pt = compact ? 'pt-4' : 'pt-6 sm:pt-10';
  // Full-page chat keeps a readable measure; the widget uses its full width
  const column = compact ? 'w-full' : 'w-full max-w-3xl mx-auto';
  const loadOlderTriggered = useRef(false);
  const scrollContainerRef = useRef(null);
  const scrollRafRef = useRef(null);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);

  useEffect(() => {
    if (!isLoadingOlder) loadOlderTriggered.current = false;
  }, [isLoadingOlder]);

  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const handleScroll = useCallback(() => {
    setIsUserNearBottom(checkNearBottom());
  }, [checkNearBottom]);

  const lastMsgStreaming = messages[messages.length - 1]?.isStreaming;
  useEffect(() => {
    if (!isUserNearBottom || !messagesEndRef?.current) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      messagesEndRef.current?.scrollIntoView({
        behavior: lastMsgStreaming ? 'auto' : 'smooth',
        block: 'end',
      });
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages, streamingState, isUserNearBottom, messagesEndRef]);

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
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth ${px} ${pt} pb-2`}
      >
        <div className={column}>
        {hasMoreMessages && (
          <div className="flex justify-center py-3">
            {isLoadingOlder ? (
              <Loader2 className="w-5 h-5 animate-spin text-chat-faint" />
            ) : (
              <button
                type="button"
                onClick={onLoadOlder}
                className="text-xs text-chat-muted hover:text-chat-text rounded-md border border-chat-line px-3 py-1.5 transition-colors"
              >
                Load older messages
              </button>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="[content-visibility:auto]">
            <AIChatMessage
              message={msg}
              onRedo={onRedo}
              onRetry={onRetry}
              onEditApplied={onEditApplied}
              onEditDeclined={onEditDeclined}
            />
          </div>
        ))}
        {streamingState && <AIChatStreamStatus state={streamingState} />}
        <div ref={messagesEndRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
      <Virtuoso
        data={messages}
        className="flex-1 min-h-0"
        style={{ minHeight: 0 }}
        followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
        alignToBottom
        atBottomStateChange={setIsUserNearBottom}
        startReached={handleStartReached}
        itemContent={(index, msg) => (
          <div className={`${px} ${index === 0 ? pt : 'pt-1'}`}>
            <div className={column}>
            <AIChatMessage
              message={msg}
              onRedo={onRedo}
              onRetry={onRetry}
              onEditApplied={onEditApplied}
              onEditDeclined={onEditDeclined}
            />
            </div>
          </div>
        )}
        components={{
          Header: () =>
            hasMoreMessages ? (
              <div className={`flex justify-center py-3 ${px}`}>
                {isLoadingOlder ? (
                  <Loader2 className="w-5 h-5 animate-spin text-chat-faint" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      loadOlderTriggered.current = true;
                      onLoadOlder?.();
                    }}
                    className="text-xs text-chat-muted hover:text-chat-text rounded-md border border-chat-line px-3 py-1.5 transition-colors"
                  >
                    Load older messages
                  </button>
                )}
              </div>
            ) : null,
          Footer: () => (
            <div className={`${px} pb-2`}>
              <div className={column}>
                {streamingState && <AIChatStreamStatus state={streamingState} />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
