/**
 * URL policy for CMS-provided links.
 *
 * Allowed: empty, http(s)://, mailto:, tel:, or a site-relative path that
 * starts with a single "/" (not "//", which is protocol-relative).
 * Everything else (javascript:, data:, vbscript:, bare hosts, ...) is rejected.
 */

// Browsers ignore ASCII control chars/whitespace inside a scheme
// ("java\tscript:"), so strip them before checking.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F\s]+/g;

const ALLOWED_SCHEME = /^(https?:\/\/|mailto:|tel:)/i;

export const isSafeUrl = (url) => {
  if (url === null || url === undefined) return true;
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '') return true;
  const normalized = trimmed.replace(CONTROL_CHARS, '');
  if (normalized.startsWith('/')) {
    // "//evil.com" and "/\evil.com" are treated as protocol-relative by browsers
    return !normalized.startsWith('//') && !normalized.startsWith('/\\');
  }
  return ALLOWED_SCHEME.test(normalized);
};

/**
 * Returns the URL when it is safe to put in an href, otherwise `fallback`
 * (undefined by default, so the attribute is omitted).
 */
export const safeHref = (url, fallback = undefined) => {
  if (typeof url !== 'string' || url.trim() === '') return fallback;
  return isSafeUrl(url) ? url.trim() : fallback;
};

export const isExternalUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());

export const URL_POLICY_MESSAGE =
  'Links must start with http://, https://, mailto:, tel:, or a single "/" for pages on this site.';

export default { isSafeUrl, safeHref, isExternalUrl, URL_POLICY_MESSAGE };
