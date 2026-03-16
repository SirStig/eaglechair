/**
 * Sanitizes streaming markdown by stripping incomplete syntax at the end.
 * Prevents raw markdown (e.g. **bold, `code, [link](url) from showing during streaming.
 */

export function sanitizeStreamingMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;

  s = s.replace(/\*\*([^*]*)$/, '$1');
  s = s.replace(/\*([^*]*)$/, '$1');
  s = s.replace(/`([^`]*)$/, '$1');
  s = s.replace(/(?<!!)\[([^\]]*)\]\(([^)]*)$/, '$1 ($2)');
  s = s.replace(/!\[([^\]]*)\]\([^)]*$/, '$1');
  s = s.replace(/\[([^\]]*)$/, '$1');
  s = s.replace(/\n#+\s*([^\n]*)$/, '\n$1');
  s = s.replace(/```[a-z]*\n?([\s\S]*)$/, (m, content) =>
    content.includes('```') ? m : content
  );

  return s;
}
