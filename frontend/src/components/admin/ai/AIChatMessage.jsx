/**
 * AI Chat Message Component
 * Renders individual messages with markdown, sources, file badges.
 * Internal links (/admin/..., /products/...) use Link for in-app navigation.
 * Action-style links (Go to, Edit, View) render with an arrow.
 */

import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, ArrowRight, RotateCcw, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react';
import { sanitizeStreamingMarkdown } from '../../../utils/sanitizeStreamingMarkdown';
import SuggestedEditCard from './SuggestedEditCard';
import ToolCallCard, { ToolCallGroup } from './ToolCallCard';
import AIMark from './AIMark';
import ResponsiveImage from '../../ui/ResponsiveImage';

const REMARK_PLUGINS = [remarkGfm];

function getLinkLabel(children) {
  if (typeof children === 'string') return children;
  const arr = Array.isArray(children) ? children : [children];
  return arr.map(c => (typeof c === 'string' ? c : (c?.props?.children != null ? getLinkLabel(c.props.children) : ''))).join('');
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Heading sizes use `!` so the site's mobile h1–h3 overrides don't apply here
const markdownComponents = {
  h1: ({ children }) => <h1 className="!text-lg font-semibold text-chat-text mt-6 mb-2 tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="!text-base font-semibold text-chat-text mt-5 mb-2 tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="!text-[15px] font-semibold text-chat-text mt-4 mb-1.5">{children}</h3>,
  h4: ({ children }) => <h4 className="!text-sm font-semibold text-chat-text mt-4 mb-1">{children}</h4>,
  hr: () => <hr className="border-chat-line my-5" />,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-3 marker:text-chat-faint">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-3 marker:text-chat-faint">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
  p: ({ children }) => <p className="leading-7 my-3">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-chat-line-strong pl-4 text-chat-muted">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-chat-line bg-dark-950 p-3.5 text-[13px] leading-relaxed font-mono text-chat-code max-w-full [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-[inherit]">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[0.85em] font-mono text-chat-code">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-chat-line max-w-full">
      <table className="w-full text-[13px] border-collapse tabular-nums">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
  tbody: ({ children }) => <tbody className="[&_tr]:border-t [&_tr]:border-chat-line">{children}</tbody>,
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium text-chat-muted whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-chat-text whitespace-nowrap">{children}</td>,
  img: ({ src, alt }) => {
    const safe = src && (src.startsWith('http') || src.startsWith('/'));
    if (!safe) return null;
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block my-2">
        <ResponsiveImage
          sizes="400px"
          fullResolution={false}
          placeholder={false}
          src={src}
          alt={alt || ''}
          loading="lazy"
          className="max-w-full max-h-[280px] sm:max-h-[320px] w-auto h-auto rounded-lg border border-chat-line object-contain"
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
    const useArrow = isAdminLink || isAction;
    const linkClass = `text-chat-link hover:text-chat-link-hover underline decoration-chat-link/30 hover:decoration-chat-link-hover underline-offset-[3px] transition-colors ${useArrow ? 'inline-flex items-center gap-1' : ''}`;
    if (isInternal) {
      return (
        <Link to={href} className={linkClass}>
          {children}
          {useArrow && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
      </a>
    );
  },
};

// Strip the outer margins so a block's first/last element sits flush
const PROSE_EDGES = '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0';

function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}

function StreamingCaret() {
  return <span className="inline-block w-[3px] h-[1.1em] bg-chat-accent/80 animate-pulse ml-0.5 align-[-0.15em] rounded-sm" />;
}

function WebSources({ sources }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;

  const LIMIT = 4;
  const shown = expanded ? sources : sources.slice(0, LIMIT);

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-chat-faint mb-2">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.snippet || source.title || source.url}
            className="group inline-flex items-center gap-2 max-w-full sm:max-w-[280px] rounded-md border border-chat-line bg-chat-surface hover:bg-chat-raised hover:border-chat-line-strong px-2.5 py-1.5 transition-colors"
          >
            <span className="flex-shrink-0 w-4 h-4 rounded bg-white/[0.06] text-[9px] font-semibold text-chat-muted flex items-center justify-center">
              {i + 1}
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="text-xs text-chat-text truncate leading-tight">{source.title || hostnameOf(source.url)}</span>
              <span className="text-[11px] text-chat-faint truncate leading-tight">{hostnameOf(source.url)}</span>
            </span>
          </a>
        ))}
        {sources.length > LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center rounded-md border border-dashed border-chat-line-strong px-2.5 py-1.5 text-xs text-chat-muted hover:text-chat-text transition-colors"
          >
            {expanded ? 'Show less' : `+${sources.length - LIMIT} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-md text-chat-faint hover:text-chat-text hover:bg-white/[0.05] transition-colors"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
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

  if (message.isStreaming) return null;

  const showRedo = !isUser && !message.isError && hasContent && onRedo;
  const showRetry = !isUser && message.isError && onRetry;
  const showCopy = hasContent;
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  if (!showRedo && !showRetry && !showCopy && !time) return null;

  return (
    <div
      className={`flex items-center gap-0.5 mt-1 transition-opacity sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-within:opacity-100 ${isUser ? 'justify-end' : 'justify-start -ml-1.5'}`}
    >
      {isUser && time && <span className="text-[11px] text-chat-faint mr-1.5">{time}</span>}
      {showCopy && (
        <ActionButton onClick={handleCopy} title={copied ? 'Copied' : 'Copy'}>
          {copied ? <Check className="w-3.5 h-3.5 text-chat-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        </ActionButton>
      )}
      {showRedo && (
        <ActionButton onClick={() => onRedo(message.id)} title="Regenerate">
          <RotateCcw className="w-3.5 h-3.5" />
        </ActionButton>
      )}
      {showRetry && (
        <ActionButton onClick={() => onRetry(message.id)} title="Retry">
          <RefreshCw className="w-3.5 h-3.5" />
        </ActionButton>
      )}
      {!isUser && time && <span className="text-[11px] text-chat-faint ml-1.5">{time}</span>}
    </div>
  );
}

// Render content blocks, merging consecutive tool calls into one group
function ContentBlocks({ message, isStreaming, onEditApplied, onEditDeclined }) {
  const blocks = message.content_blocks;
  const out = [];
  let toolRun = [];

  const flushTools = (key) => {
    if (toolRun.length === 0) return;
    out.push(<ToolCallGroup key={`tools-${key}`}>{toolRun}</ToolCallGroup>);
    toolRun = [];
  };

  blocks.forEach((block, i) => {
    if ((block.type === 'tool_call' || block.type === 'tool_call_in_progress') && block.data) {
      toolRun.push(
        <ToolCallCard
          key={i}
          name={block.data.name}
          label={block.data.label}
          args={block.data.args}
          result={block.type === 'tool_call' ? block.data.result : undefined}
          status={block.type === 'tool_call_in_progress' ? 'in_progress' : (block.data.status || 'done')}
        />
      );
      return;
    }
    flushTools(i);
    if (block.type === 'text') {
      const isLast = i === blocks.length - 1;
      const text = isStreaming && isLast
        ? sanitizeStreamingMarkdown(block.content || '')
        : (block.content || '');
      out.push(
        <div key={i} className={PROSE_EDGES}>
          <Markdown>{text}</Markdown>
          {isStreaming && isLast && <StreamingCaret />}
        </div>
      );
    } else if (block.type === 'suggested_edit' && block.data) {
      out.push(
        <SuggestedEditCard
          key={i}
          edit={block.data}
          onApplied={(e) => onEditApplied?.(message, e)}
          onDeclined={(e) => onEditDeclined?.(message, e)}
        />
      );
    }
  });
  flushTools('end');

  return <div className="space-y-3">{out}</div>;
}

function AIChatMessage({ message, onRedo, onRetry, onEditApplied, onEditDeclined }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const rawContent = isStreaming ? message.streamingContent : message.content;
  const content = isStreaming ? sanitizeStreamingMarkdown(rawContent) : rawContent;
  const hasFiles = message.file_ids && message.file_ids.length > 0;
  const hasBlocks = message.content_blocks && message.content_blocks.length > 0;

  const fileBadges = hasFiles && (
    <div className={`flex flex-wrap gap-1.5 mb-2 ${isUser ? 'justify-end' : ''}`}>
      {message.file_ids.map(fid => (
        <span key={fid} className="inline-flex items-center gap-1.5 rounded-md border border-chat-line-strong bg-chat-raised px-2 py-1 text-xs text-chat-muted">
          <Paperclip className="w-3 h-3" />
          Attachment
        </span>
      ))}
    </div>
  );

  if (isUser) {
    return (
      <div className="group/msg flex flex-col items-end mb-6 min-w-0">
        {fileBadges}
        {content && (
          <div className="max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-br-md bg-chat-user-bubble border border-white/[0.04] px-4 py-2.5 text-[15px] leading-7 text-chat-text">
            <p className="whitespace-pre-wrap break-words">{content}</p>
          </div>
        )}
        <MessageActions message={message} isUser />
      </div>
    );
  }

  return (
    <div className="group/msg flex gap-3 mb-6 min-w-0">
      <AIMark size="sm" className="mt-0.5 hidden sm:flex" />
      <div className="flex-1 min-w-0">
        {fileBadges}
        <div className="text-[15px] leading-7 text-chat-text overflow-hidden break-words space-y-3">
          {hasBlocks ? (
            <ContentBlocks
              message={message}
              isStreaming={isStreaming}
              onEditApplied={onEditApplied}
              onEditDeclined={onEditDeclined}
            />
          ) : !message.isError && (
            <div className="space-y-3">
              <div className={PROSE_EDGES}>
                <Markdown>{content}</Markdown>
                {isStreaming && <StreamingCaret />}
              </div>
              {message.tool_calls && message.tool_calls.length > 0 && (
                <ToolCallGroup>
                  {message.tool_calls.map((tc, i) => (
                    <ToolCallCard
                      key={i}
                      name={tc.name}
                      label={tc.label}
                      args={tc.args}
                      result={tc.result}
                      status={tc.status || 'done'}
                    />
                  ))}
                </ToolCallGroup>
              )}
              {message.suggested_edits && message.suggested_edits.map((edit, i) => (
                <SuggestedEditCard
                  key={i}
                  edit={edit}
                  onApplied={(e) => onEditApplied?.(message, e)}
                  onDeclined={(e) => onEditDeclined?.(message, e)}
                />
              ))}
            </div>
          )}
          {message.isError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-sm leading-6 text-red-300">
              <AlertCircle className="w-4 h-4 mt-1 flex-shrink-0" />
              <p className="min-w-0 whitespace-pre-wrap">{content || 'Something went wrong.'}</p>
            </div>
          )}
        </div>

        {message.web_sources && message.web_sources.length > 0 && (
          <WebSources sources={message.web_sources} />
        )}

        <MessageActions message={message} onRedo={onRedo} onRetry={onRetry} isUser={false} />
      </div>
    </div>
  );
}

export default memo(AIChatMessage);
