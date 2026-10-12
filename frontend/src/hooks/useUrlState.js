import { useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * URL-backed state: filters, search terms, tabs, sort, page and open records
 * live in the query string, so a copied link or "open in new tab" restores
 * the exact view.
 *
 * Values equal to the default are dropped from the URL to keep links short.
 * The value type follows the default: number, boolean, array (comma list) or
 * string. Pass `null` as the default for an optional string, or `null` with
 * `{ type: 'number' }` for an optional numeric id.
 *
 * Writes replace the current history entry by default (typing in a search
 * box shouldn't flood Back). Pass `{ push: true }` for navigations the user
 * expects Back to undo, like opening a record's detail view.
 */

// Read the live query string, not the render-time one, so several setters
// fired in the same handler (sort + direction + reset page) all stick.
// BrowserRouter updates window.location synchronously on navigate.
function currentSearch(fallback) {
  return typeof window !== 'undefined' ? window.location.search : fallback;
}

function currentPath(fallback) {
  return typeof window !== 'undefined' ? window.location.pathname : fallback;
}

export function parseUrlValue(raw, defaultValue, type) {
  if (raw === null || raw === undefined) return defaultValue;
  if (type === 'number') {
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) ? n : defaultValue;
  }
  if (Array.isArray(defaultValue)) return raw === '' ? [] : raw.split(',');
  if (typeof defaultValue === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }
  if (typeof defaultValue === 'boolean') return raw === 'true' || raw === '1';
  return raw;
}

export function serializeUrlValue(value, defaultValue) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const joined = value.map(String).join(',');
    return Array.isArray(defaultValue) && joined === defaultValue.map(String).join(',') ? null : joined;
  }
  if (value === defaultValue) return null;
  return String(value);
}

/**
 * Apply `{ key: value }` updates to a query string. `null`/`undefined`/''/[]
 * removes the key. Returns the new search string (with leading '?', or '').
 */
export function applySearchUpdates(search, updates, defaults = {}) {
  const params = new URLSearchParams(search);
  Object.entries(updates).forEach(([key, value]) => {
    const raw = serializeUrlValue(value, defaults[key]);
    if (raw === null) params.delete(key);
    else params.set(key, raw);
  });
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Setter for several query params at once: `setParams({ tab: 'x', page: null })` */
export function useSetUrlParams() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((updates, { push = false, defaults } = {}) => {
    const search = currentSearch(location.search);
    const next = applySearchUpdates(search, updates, defaults);
    if (next === (search || '')) return;
    navigate(
      { pathname: currentPath(location.pathname), search: next, hash: location.hash },
      { replace: !push, preventScrollReset: true }
    );
  }, [navigate, location.pathname, location.search, location.hash]);
}

export function useUrlState(key, defaultValue = '', { push = false, type } = {}) {
  const location = useLocation();
  const setParams = useSetUrlParams();
  // Callers often pass literals ([] / {}); pin the first one so the parsed
  // value keeps a stable identity across renders.
  const defaultRef = useRef(defaultValue);

  const raw = new URLSearchParams(location.search).get(key);
  const value = useMemo(() => parseUrlValue(raw, defaultRef.current, type), [raw, type]);

  const setValue = useCallback((next, options = {}) => {
    const live = new URLSearchParams(currentSearch('')).get(key);
    const prev = parseUrlValue(live, defaultRef.current, type);
    const resolved = typeof next === 'function' ? next(prev) : next;
    setParams(
      { [key]: resolved },
      { push: options.push ?? push, defaults: { [key]: defaultRef.current } }
    );
  }, [key, push, type, setParams]);

  return [value, setValue];
}

export default useUrlState;
