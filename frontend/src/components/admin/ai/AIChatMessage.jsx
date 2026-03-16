/**
 * AI Chat Message Component
 * Renders individual messages with markdown, sources, file badges.
 * Internal links (/admin/..., /products/...) use Link for in-app navigation.
 * Action-style links (Go to, Edit, View) render as buttons.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, ChevronDown, ChevronUp, Paperclip, Globe, ArrowRight, RotateCcw, RefreshCw, Copy, Check } from 'lucide-react';
import { sanitizeStreamingMarkdown } from '../../../utils/sanitizeStreamingMarkdown';
import SuggestedEditCard from './SuggestedEditCard';

function getLinkLabel(children) {
  if (typeof children === 'string') return children;
  const arr = Array.isArray(children) ? children : [children];
  return arr.map(c => (typeof c === 'string' ? c : (c?.props?.children != null ? getLinkLabel(c.props.children) : ''))).join('');
}

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-dark-50 mt-4 mb-2 tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-dark-50 mt-4 mb-1.5 tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-dark-50 mt-3 mb-1.5 tracking-tight">{children}</h3>,
  hr: () => <hr className="border-dark-600 my-4" />,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 my-2 pl-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 my-2 pl-0.5">{children}</ol>,
  li: ({ children }) => <li className="ml-2 leading-[1.7]">{children}</li>,
  p: ({ children }) => <p className="text-dark-100 leading-[1.7] tracking-[0.01em] mb-2 last:mb-0">{children}</p>,
  pre: ({ children }) => (
    <pre className="bg-dark-950 border border-dark-700 rounded-lg p-2 sm:p-3 my-2 overflow-x-auto text-xs font-mono text-dark-100 max-w-full">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-xs font-mono text-chat-code">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 max-w-full">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="[&_tr]:border-b [&_tr]:border-dark-600">{children}</thead>,
  tbody: ({ children }) => <tbody className="[&_tr]:border-b [&_tr]:border-dark-700/50 [&_tr]:hover:bg-dark-800/30">{children}</tbody>,
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left text-dark-300 font-semibold whitespace-nowrap leading-[1.6]">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 text-dark-200 whitespace-nowrap leading-[1.6]">{children}</td>,
  img: ({ src, alt }) => {
    const safe = src && (src.startsWith('http') || src.startsWith('/'));
    if (!safe) return null;
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block my-2">
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          className="max-w-full max-h-[280px] sm:max-h-[320px] w-auto h-auto rounded-lg border border-dark-600 object-contain"
          style={{ maxWidth: 'min(100%, 400px)' }}
        />
      </a>
    );
  },
  a: ({ href = '', children }) => {
    const label = getLinkLabel(children);
    const isInternal = href.startsWith('/') && !href.startsWith('//');
    const isAdminLink = isInternal && href.startsWith('/admin');
    const isAction = /^(go to|edit|view|open|manage|add|create)\s/i.test(label.toLowerCase()) || label.includes('→');
    const useButtonStyle = isAdminLink || isAction;
    const btnClass = useButtonStyle
      ? 'inline-flex items-center gap-1 text-chat-link hover:text-chat-link-hover underline underline-offset-2 hover:bg-chat-link/5 rounded px-0.5 -mx-0.5 transition-colors'
      : 'text-chat-link hover:text-chat-link-hover underline underline-offset-2';
    if (isInternal) {
      return (
        <Link to={href} className={btnClass}>
          {useButtonStyle && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={btnClass}>
        {children}
      </a>
    );
  },
};

function WebSources({ sources }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;

  const shown = expanded ? sources : sources.slice(0, 3);

  return (
    <div className="mt-2 pt-2 border-t border-dark-700/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Globe className="w-3 h-3 text-dark-400" />
        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wide">Sources</span>
      </div>
      <div className="space-y-1">
        {shown.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 group"
          >
            <ExternalLink className="w-3 h-3 text-dark-500 group-hover:text-chat-link flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] text-chat-link group-hover:text-chat-link-hover truncate leading-tight">
                {source.title || source.url}
              </p>
              {source.snippet && (
                <p className="text-[10px] text-dark-400 truncate">{source.snippet}</p>
              )}
            </div>
          </a>
        ))}
      </div>
      {sources.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-1.5 text-[10px] text-dark-400 hover:text-dark-200"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Show less' : `${sources.length - 3} more sources`}
        </button>
      )}
    </div>
  );
}

function MessageActions({ message, onRedo, onRetry, isUser }) {
  const [copied, setCopied] = useState(false);
  const rawContent = message.isStreaming ? message.streamingContent : message.content;
  const hasContent = rawContent && String(rawContent).trim().length > 0;

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(String(rawContent));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const showRedo = !isUser && !message.isError && !message.isStreaming && hasContent && onRedo;
  const showRetry = !isUser && message.isError && onRetry;
  const showCopy = hasContent;

  if (!showRedo && !showRetry && !showCopy) return null;

  return (
    <div className={`flex items-center gap-0.5 mt-1 ${isUser ? 'justify-end' : 'justify-start'} ${!isUser ? 'ml-8 sm:ml-9' : ''}`}>
      {showRedo && (
        <button
          type="button"
          onClick={() => onRedo(message.id)}
          className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-colors"
          title="Redo (delete and resend)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
      {showRetry && (
        <button
          type="button"
          onClick={() => onRetry(message.id)}
          className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-colors"
          title="Retry"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 transition-colors"
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-chat-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function AIChatMessage({ message, onRedo, onRetry, onEditApplied }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const rawContent = isStreaming ? message.streamingContent : message.content;
  const content = isStreaming ? sanitizeStreamingMarkdown(rawContent) : rawContent;

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      {!isUser && (
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 p-1">
          <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
        </div>
      )}

      <div className={`
        w-full max-w-full text-[15px] leading-[1.7] tracking-[0.01em]
        ${isUser
          ? 'max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 bg-chat-user-bubble hover:bg-chat-user-bubble-hover text-white rounded-tr-sm'
          : 'px-0 py-2 text-dark-100'
        }
        ${!isUser && message.isError ? 'text-red-300' : ''}
      `}>
        {/* File badges */}
        {message.file_ids && message.file_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {message.file_ids.map(fid => (
              <span key={fid} className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5 text-[10px]">
                <Paperclip className="w-2.5 h-2.5" />
                File
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        {isUser ? (
          <p className="whitespace-pre-wrap leading-[1.7] tracking-[0.01em]">{content}</p>
        ) : (
          <div className="space-y-1 [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_p:first-child]:mt-0 [&_ul:first-child]:mt-0 [&_ol:first-child]:mt-0">
            <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-chat-accent animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Suggested edits */}
        {!isUser && message.suggested_edits && message.suggested_edits.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dark-700/50 space-y-2">
            {message.suggested_edits.map((edit, i) => (
              <SuggestedEditCard
                key={i}
                edit={edit}
                onApplied={onEditApplied}
              />
            ))}
          </div>
        )}

        {/* Web sources */}
        {!isUser && message.web_sources && message.web_sources.length > 0 && (
          <WebSources sources={message.web_sources} />
        )}

        {/* Timestamp */}
        {!isStreaming && message.created_at && (
          <p className={`text-[9px] mt-1.5 ${isUser ? 'text-white/50' : 'text-dark-500'}`}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {isUser && (
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 ml-2 mt-0.5">
          <span className="text-[10px] font-bold text-dark-300">You</span>
        </div>
      )}
      </div>
      <MessageActions message={message} onRedo={onRedo} onRetry={onRetry} isUser={isUser} />
    </div>
  );
}
