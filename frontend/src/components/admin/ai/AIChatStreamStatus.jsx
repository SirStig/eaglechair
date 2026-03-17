/**
 * AI Chat Stream Status
 * Shows real-time state: thinking, searching, fetching URL, calculating
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Calculator, Brain, Loader2 } from 'lucide-react';

export default function AIChatStreamStatus({ state }) {
  if (!state) return null;

  const icons = {
    thinking: <Brain className="w-3.5 h-3.5 text-chat-status-thinking animate-pulse" />,
    searching: <Search className="w-3.5 h-3.5 text-chat-status-searching" />,
    search_results: <Search className="w-3.5 h-3.5 text-chat-status-success" />,
    fetching_url: <Globe className="w-3.5 h-3.5 text-chat-status-fetching" />,
    calculating: <Calculator className="w-3.5 h-3.5 text-chat-status-calculating" />,
  };

  const labels = {
    thinking: state.message || 'Thinking...',
    searching: `Searching: "${state.query}"${state.count > 1 ? ` (search #${state.count})` : ''}`,
    search_results: `Found ${state.sources?.length || 0} results`,
    fetching_url: `Reading: ${state.url ? new URL(state.url).hostname : '...'}`,
    calculating: `Calculating: ${state.expression || '...'}`,
  };

  const colors = {
    thinking: 'text-chat-status-thinking',
    searching: 'text-chat-status-searching',
    search_results: 'text-chat-status-success',
    fetching_url: 'text-chat-status-fetching',
    calculating: 'text-chat-status-calculating',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.type + (state.query || state.url || '')}
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="flex items-center gap-2 px-3 py-2 mb-2"
      >
        <div className="flex items-center gap-1.5 bg-dark-800 border border-dark-700 rounded-full px-3 py-1.5">
          {icons[state.type] || <Loader2 className="w-3.5 h-3.5 text-dark-400 animate-spin" />}
          <span className={`text-xs ${colors[state.type] || 'text-dark-300'} truncate max-w-[180px] sm:max-w-[250px]`}>
            {labels[state.type] || 'Processing...'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
