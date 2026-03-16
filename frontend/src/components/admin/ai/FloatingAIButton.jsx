/**
 * Floating AI Button
 * Hovering button in the bottom-right of admin pages.
 * Opens the AI chat widget.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAIChat } from '../../../contexts/AIChatContext';

export default function FloatingAIButton() {
  const { isOpen, openChat, closeChat, isStreaming } = useAIChat();

  return (
    <motion.button
      onClick={isOpen ? closeChat : openChat}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        fixed z-[998]
        bottom-[calc(1rem+env(safe-area-inset-bottom))]
        right-[calc(1rem+env(safe-area-inset-right))]
        sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]
        sm:right-[calc(1.5rem+env(safe-area-inset-right))]
        w-12 h-12 sm:w-14 sm:h-14 rounded-2xl shadow-2xl overflow-hidden
        flex items-center justify-center
        transition-all duration-300
        ${isOpen
          ? 'bg-dark-700 border border-dark-600'
          : 'bg-chat-button hover:bg-chat-button-hover'
        }
      `}
      title={isOpen ? 'Close AI Chat' : 'Open AI Assistant'}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-5 h-5 text-dark-200" />
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full h-full flex items-center justify-center p-0.5"
          >
            <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-dark-800 animate-pulse" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
