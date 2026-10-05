/**
 * Word-level diff for the Time Machine's before/after view.
 *
 * Returns [{ type: 'same' | 'del' | 'ins', text }] or null when the texts
 * are too long to diff in the browser (the caller shows them side by side).
 * Common prefix/suffix are trimmed first, so a one-word fix in a long
 * description stays cheap.
 */

const MAX_CELLS = 1_500_000;

const tokenize = (text) => String(text ?? '').split(/(\s+)/).filter((t) => t !== '');

export function wordDiff(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > MAX_CELLS) return null;

  // LCS table over the changed middle
  const n = midA.length;
  const m = midB.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts = [];
  const push = (type, text) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  if (start > 0) push('same', a.slice(0, start).join(''));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      push('same', midA[i]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('del', midA[i]);
      i += 1;
    } else {
      push('ins', midB[j]);
      j += 1;
    }
  }
  while (i < n) push('del', midA[i++]);
  while (j < m) push('ins', midB[j++]);
  if (endA < a.length) push('same', a.slice(endA).join(''));
  return parts;
}
