import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Loader2 } from 'lucide-react';

const TOOL_LABELS = {
  web_search: 'Searched the web',
  fetch_webpage: 'Read webpage',
  calculate: 'Calculated',
  search_catalog: 'Searched catalog',
  search_training_data: 'Searched training data',
  get_product_catalog: 'Loaded catalog',
  get_training_vs_catalog_overview: 'Compared training to catalog',
  get_product_details: 'Fetched product details',
  create_product: 'Created product',
  propose_edit: 'Suggested edit',
};

const TOOL_LABELS_IN_PROGRESS = {
  web_search: 'Searching the web',
  fetch_webpage: 'Reading webpage',
  calculate: 'Calculating',
  search_catalog: 'Searching catalog',
  search_training_data: 'Searching training data',
  get_product_catalog: 'Loading catalog',
  get_training_vs_catalog_overview: 'Comparing training to catalog',
  get_product_details: 'Fetching product details',
  create_product: 'Creating product',
  propose_edit: 'Suggesting edit',
};

function friendlyLabel(name, label, inProgress) {
  if (label) return label;
  const map = inProgress ? TOOL_LABELS_IN_PROGRESS : TOOL_LABELS;
  return map[name] || name.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

// One-line summary of the call's arguments: prefer the values over JSON
function summarizeArgs(args) {
  if (!args || typeof args !== 'object') return null;
  const values = Object.values(args).filter(v => v !== null && v !== undefined && v !== '');
  if (values.length === 0) return null;
  const first = values[0];
  return typeof first === 'object' ? JSON.stringify(first) : String(first);
}

/**
 * A single tool call, rendered as a row. Wrap consecutive calls in
 * ToolCallGroup so they share one container.
 */
export default function ToolCallCard({ name, label, args, result, status = 'done' }) {
  const [expanded, setExpanded] = useState(false);
  const isInProgress = status === 'in_progress';
  const displayLabel = friendlyLabel(name, label, isInProgress);
  const argSummary = summarizeArgs(args);
  const hasDetails = !isInProgress && ((args && Object.keys(args).length > 0) || result);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((e) => !e)}
        aria-expanded={hasDetails ? expanded : undefined}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left min-w-0 ${hasDetails ? 'hover:bg-white/[0.02] cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {isInProgress ? (
            <Loader2 className="w-3.5 h-3.5 text-chat-accent animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5 text-chat-faint" />
          )}
        </span>
        <span className={`text-[13px] flex-shrink-0 ${isInProgress ? 'text-chat-text' : 'text-chat-muted'}`}>
          {displayLabel}
        </span>
        {argSummary && (
          <span className="text-[12px] text-chat-faint font-mono truncate min-w-0 flex-1">{argSummary}</span>
        )}
        {hasDetails && (
          <ChevronRight
            className={`w-3.5 h-3.5 ml-auto flex-shrink-0 text-chat-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && hasDetails && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-9 space-y-2">
              {args && Object.keys(args).length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-chat-faint mb-1">Input</p>
                  <pre className="p-2.5 rounded-md bg-dark-950 border border-chat-line text-chat-muted overflow-x-auto text-[11px] leading-relaxed font-mono">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              {result && (
                <div>
                  <p className="text-[11px] font-medium text-chat-faint mb-1">Output</p>
                  <pre className="p-2.5 rounded-md bg-dark-950 border border-chat-line text-chat-muted overflow-x-auto text-[11px] leading-relaxed font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ToolCallGroup({ children }) {
  return (
    <div className="my-1 rounded-lg border border-chat-line bg-chat-surface divide-y divide-chat-line overflow-hidden">
      {children}
    </div>
  );
}
