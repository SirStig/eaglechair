import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';

function truncate(obj, maxLen = 120) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export default function ToolCallCard({ name, args, result, status = 'done' }) {
  const [expanded, setExpanded] = useState(false);
  const argsStr = args && Object.keys(args).length > 0 ? truncate(args, 80) : null;
  const resultStr = result ? truncate(result, 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mt-2 p-2.5 rounded-lg bg-dark-800 border border-dark-700"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-dark-500">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <Wrench className="w-3 h-3 text-chat-status-fetching flex-shrink-0" />
        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wide">{name}</span>
        {argsStr && !expanded && (
          <span className="text-[11px] text-dark-500 truncate flex-1 min-w-0">{argsStr}</span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
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
