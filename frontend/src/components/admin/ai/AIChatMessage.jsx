/**
 * AI Chat Message Component
 * Renders individual messages with markdown, sources, file badges.
 * Internal links (/admin/..., /products/...) use Link for in-app navigation.
 * Action-style links (Go to, Edit, View) render as buttons.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronUp, Paperclip, Globe, ArrowRight } from 'lucide-react';
import { sanitizeStreamingMarkdown } from '../../../utils/sanitizeStreamingMarkdown';

// Simple markdown renderer (bold, italic, code, lists, headers, links)
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-dark-50 mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-dark-50 mt-4 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-dark-50 mt-4 mb-2">{line.slice(2)}</h1>);
    // Horizontal rule
    } else if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="border-dark-600 my-3" />);
    // Bullet lists
    } else if (line.match(/^[*\-] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[*\-] /)) {
        items.push(<li key={i} className="ml-2">{renderInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1">{items}</ul>);
      continue;
    // Numbered lists
    } else if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} className="ml-2">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1">{items}</ol>);
      continue;
    // Code blocks
    } else if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-dark-950 border border-dark-700 rounded-lg p-2 sm:p-3 my-2 overflow-x-auto text-xs font-mono text-dark-100 max-w-full">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
    // Table
    } else if (line.startsWith('|')) {
      const rows = [];
      let isHeader = true;
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) {
          const cells = lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          rows.push({ cells, isHeader });
          isHeader = false;
        }
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2 max-w-full">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              {rows.filter(r => r.isHeader).map((row, ri) => (
                <tr key={ri} className="border-b border-dark-600">
                  {row.cells.map((cell, ci) => (
                    <th key={ci} className="px-2 py-1 text-left text-dark-300 font-semibold whitespace-nowrap">{cell.trim()}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.filter(r => !r.isHeader).map((row, ri) => (
                <tr key={ri} className="border-b border-dark-700/50 hover:bg-dark-800/30">
                  {row.cells.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-dark-200 whitespace-nowrap">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    // Empty lines → paragraph spacing
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    // Regular paragraph
    } else {
      elements.push(<p key={i} className="text-dark-100 leading-relaxed">{renderInline(line)}</p>);
    }

    i++;
  }

  return elements;
}

function renderInline(text) {
  // Handle bold, italic, code, and links
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold+italic
    const boldItalic = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalic) {
      parts.push(<strong key={key++} className="font-bold italic">{boldItalic[1]}</strong>);
      remaining = remaining.slice(boldItalic[0].length);
      continue;
    }
    // Bold
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      parts.push(<strong key={key++} className="font-semibold text-dark-50">{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
      continue;
    }
    // Italic
    const italic = remaining.match(/^\*(.+?)\*/);
    if (italic) {
      parts.push(<em key={key++}>{italic[1]}</em>);
      remaining = remaining.slice(italic[0].length);
      continue;
    }
    // Inline code
    const code = remaining.match(/^`([^`]+)`/);
    if (code) {
      parts.push(
        <code key={key++} className="bg-dark-800 border border-dark-600 rounded px-1 py-0.5 text-xs font-mono text-chat-code">
          {code[1]}
        </code>
      );
      remaining = remaining.slice(code[0].length);
      continue;
    }
    // Link
    const link = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      const href = link[2];
      const label = link[1];
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const isAdminLink = isInternal && href.startsWith('/admin');
      const isAction = /^(go to|edit|view|open|manage|add|create)\s/i.test(label.toLowerCase()) || label.includes('→');
      const useButtonStyle = isAdminLink || isAction;
      const btnClass = useButtonStyle
        ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 hover:text-primary-300 border border-primary-500/40 font-medium no-underline'
        : 'text-chat-link hover:text-chat-link-hover underline underline-offset-2';
      if (isInternal) {
        parts.push(
          <Link key={key++} to={href} className={btnClass}>
            {useButtonStyle && <ArrowRight className="w-3 h-3 flex-shrink-0" />}
            {label}
          </Link>
        );
      } else {
        parts.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={btnClass}>
            {label}
          </a>
        );
      }
      remaining = remaining.slice(link[0].length);
      continue;
    }
    // Regular char
    const nextSpecial = remaining.search(/\*\*\*|\*\*|\*|`|\[/);
    if (nextSpecial === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      remaining = '';
    } else if (nextSpecial > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
  }
  return parts;
}

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

export default function AIChatMessage({ message, compact = false }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;
  const rawContent = isStreaming ? message.streamingContent : message.content;
  const content = isStreaming ? sanitizeStreamingMarkdown(rawContent) : rawContent;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 p-1">
          <img src="/favicon.svg" alt="Eagle Chair" className="w-full h-full object-contain" />
        </div>
      )}

      <div className={`
        max-w-[92%] sm:max-w-[85%] rounded-2xl px-3 py-2.5 text-sm
        ${isUser
          ? 'bg-chat-user-bubble hover:bg-chat-user-bubble-hover text-white rounded-tr-sm'
          : 'bg-dark-800 border border-dark-700 text-dark-100 rounded-tl-sm'
        }
        ${message.isError ? 'border-red-500/50 bg-red-900/20 text-red-300' : ''}
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
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className="space-y-0.5">
            {renderMarkdown(content)}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-chat-accent animate-pulse ml-0.5 align-middle" />
            )}
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
  );
}
