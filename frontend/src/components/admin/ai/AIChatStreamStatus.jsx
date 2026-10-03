/**
 * AI Chat Stream Status
 * Shows real-time state: thinking, searching, fetching URL, calculating
 */

import { Search, Globe, Calculator, Loader2, Check } from 'lucide-react';
import AIMark from './AIMark';

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '…';
  }
}

export default function AIChatStreamStatus({ state }) {
  if (!state) return null;

  const icons = {
    thinking: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    searching: <Search className="w-3.5 h-3.5" />,
    search_results: <Check className="w-3.5 h-3.5" />,
    fetching_url: <Globe className="w-3.5 h-3.5" />,
    calculating: <Calculator className="w-3.5 h-3.5" />,
  };

  const labels = {
    thinking: state.message || 'Thinking',
    searching: `Searching “${state.query}”${state.count > 1 ? ` · search ${state.count}` : ''}`,
    search_results: `Found ${state.sources?.length || 0} results`,
    fetching_url: `Reading ${state.url ? hostnameOf(state.url) : '…'}`,
    calculating: `Calculating ${state.expression || ''}`.trim(),
  };

  return (
    <div className="flex gap-3 mb-6 min-w-0" role="status" aria-live="polite">
      <AIMark size="sm" className="hidden sm:flex" />
      <div className="flex items-center gap-2 h-7 min-w-0 text-chat-muted">
        <span className="flex-shrink-0 text-chat-accent">
          {icons[state.type] || <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        </span>
        <span className="text-[13px] truncate">{labels[state.type] || 'Working'}</span>
      </div>
    </div>
  );
}
