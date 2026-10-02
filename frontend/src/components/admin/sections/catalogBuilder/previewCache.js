/**
 * Client-side cache of rendered page previews, keyed by the exact preview
 * payload (see previewPayload). Flipping between pages, undo/redo and
 * neighbours prefetched while idle show instantly instead of re-rendering on
 * the server. Concurrent requests for the same key share one request.
 */
import { previewPage } from '../../../../services/catalogToolsService';
import { previewPayload } from './pageModel';

const MAX_ENTRIES = 60;
const cache = new Map();
const inflight = new Map();

export const previewKey = (payload, index) => `${index}:${JSON.stringify(payload)}`;

export const getCachedPreview = (key) => {
  const hit = cache.get(key);
  if (hit) {
    // refresh LRU position
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
};

const remember = (key, value) => {
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
};

export const clearPreviewCache = () => {
  cache.clear();
  inflight.clear();
};

/** The preview for (payload, index): cached, already in flight, or fetched now. */
export const loadPreview = (payload, index, key = previewKey(payload, index), { signal } = {}) => {
  const hit = getCachedPreview(key);
  if (hit) return Promise.resolve(hit);
  if (inflight.has(key)) return inflight.get(key);
  const request = previewPage(payload, index, { signal })
    .then((result) => {
      remember(key, result);
      return result;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
};

/** Warm the cache for other pages of the document (fire and forget). */
export const prefetchPreviews = (document, indexes) => {
  indexes
    .filter((i) => i >= 0 && i < document.pages.length)
    .forEach((i) => {
      const payload = previewPayload(document, i);
      const key = previewKey(payload, i);
      if (!cache.has(key) && !inflight.has(key)) loadPreview(payload, i, key).catch(() => {});
    });
};
