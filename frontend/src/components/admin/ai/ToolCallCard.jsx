import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';

const TOOL_LABELS = {
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

function friendlyLabel(name, label) {
  if (label) return label;
  return TOOL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(obj, maxLen = 120) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export default function ToolCallCard({ name, label, args, result, status = 'done' }) {
  const [expanded, setExpanded] = useState(false);
  const displayLabel = friendlyLabel(name, label);
  const argsStr = args && Object.keys(args).length > 0 ? truncate(args, 80) : null;
  const isInProgress = status === 'in_progress';

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="mt-2 p-2.5 rounded-lg bg-dark-800 border border-dark-700"
    >
      <button
        type="button"
        onClick={() => !isInProgress && setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-dark-500">
          {!isInProgress && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        </span>
        {isInProgress ? (
          <Loader2 className="w-3.5 h-3.5 text-chat-status-fetching animate-spin flex-shrink-0" />
        ) : (
          <Wrench className="w-3 h-3 text-chat-status-fetching flex-shrink-0" />
        )}
        <span className={`text-[11px] ${isInProgress ? 'text-chat-status-fetching' : 'text-dark-400'}`}>
          {displayLabel}{isInProgress ? '…' : ''}
        </span>
        {argsStr && !expanded && !isInProgress && (
          <span className="text-[11px] text-dark-500 truncate flex-1 min-w-0">{argsStr}</span>
        )}
      </button>
      <AnimatePresence>
        {expanded && !isInProgress && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-dark-700 space-y-1.5 text-[11px]">
              {args && Object.keys(args).length > 0 && (
                <div>
                  <span className="text-dark-500 font-medium">Args:</span>
                  <pre className="mt-0.5 p-1.5 rounded bg-dark-900 text-dark-300 overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>
              )}
              {result && (
                <div>
                  <span className="text-dark-500 font-medium">Result:</span>
                  <pre className="mt-0.5 p-1.5 rounded bg-dark-900 text-dark-300 overflow-x-auto text-[10px] font-mono max-h-32 overflow-y-auto">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
