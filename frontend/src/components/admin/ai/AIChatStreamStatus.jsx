/**
 * AI Chat Stream Status
 * Shows real-time state: thinking, searching, fetching URL, calculating, batch progress
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

  if (state.type === 'progress') {
    const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
    return (
      <div className="flex gap-3 mb-6 min-w-0" role="status" aria-live="polite">
        <AIMark size="sm" className="hidden sm:flex" />
        <div className="flex-1 max-w-sm min-w-0 pt-1">
          <div className="flex items-center gap-2 text-[13px] text-chat-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-chat-accent" />
            <span className="truncate">{state.message || 'Working'}</span>
            {state.total > 0 && (
              <span className="ml-auto tabular-nums text-chat-faint">{state.done}/{state.total}</span>
            )}
          </div>
          {state.total > 0 && (
            <div
              className="mt-2 h-1 rounded-full bg-chat-line overflow-hidden"
              role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done}
            >
              <div className="h-full bg-chat-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

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
