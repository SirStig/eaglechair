/**
 * Floating AI Button
 * Hovering button in the bottom-right of admin pages.
 * Opens the AI chat widget.
 */

import { m, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAIChat } from '../../../contexts/AIChatContext';

export default function FloatingAIButton() {
  const { isOpen, openChat, closeChat, isStreaming } = useAIChat();

  return (
    <m.button
      onClick={isOpen ? closeChat : openChat}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        fixed z-[998]
        bottom-[calc(1rem+env(safe-area-inset-bottom))]
        right-[calc(1rem+env(safe-area-inset-right))]
        sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]
        sm:right-[calc(1.5rem+env(safe-area-inset-right))]
        w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-2xl shadow-black/60
        flex items-center justify-center
        border transition-colors duration-200
        ${isOpen
          ? 'bg-chat-raised border-chat-line-strong'
          : 'bg-chat-raised hover:bg-[#232323] border-chat-line-strong hover:border-chat-accent/50'
        }
      `}
      title={isOpen ? 'Close Eagle AI' : 'Open Eagle AI'}
      aria-label={isOpen ? 'Close Eagle AI' : 'Open Eagle AI'}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <m.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-5 h-5 text-chat-text" />
          </m.div>
        ) : (
          <m.div
            key="open"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full h-full flex items-center justify-center p-3 sm:p-3.5"
          >
            <img src="/assets/eagle-mark-white.png" alt="" aria-hidden className="w-full h-full object-contain" />
            {isStreaming && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-chat-accent ring-2 ring-chat-raised animate-pulse" />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.button>
  );
}
