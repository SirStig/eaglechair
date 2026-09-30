/**
 * Content Data Dynamic Loader
 *
 * Loads contentData.json from /data/ at runtime. This prevents Vite from
 * bundling it, allowing the backend to update it without a frontend rebuild.
 *
 * Sources, in order:
 * 1. window.__INITIAL_CONTENT__ - embedded by the SSR server, so the first
 *    client render matches the server HTML with no fetch at all.
 * 2. window.__contentDataPromise - index.html starts the fetch before the
 *    bundle loads; the first loadContentData() call adopts it.
 * 3. A fresh fetch. The server sends no-cache + ETag, so `cache: 'no-cache'`
 *    revalidates cheaply (304) instead of re-downloading.
 */

import logger from './logger';

const CONTEXT = 'ContentDataLoader';

let contentCache = null;
let contentCacheTimestamp = 0;
let inflight = null;
// Incremented by clearContentCache(); a load started under an older
// generation must not write its result back into the cache.
let generation = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Validate content structure
 */
const validateContent = (content) => {
  if (!content || typeof content !== 'object') {
    return false;
  }
  const required = ['siteSettings', 'heroSlides', 'salesReps'];
  return required.every(key => content[key] !== undefined);
};

const fetchContentData = async () => {
  const response = await fetch('/data/contentData.json', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

const takeBootstrapPromise = () => {
  if (typeof window === 'undefined' || !window.__contentDataPromise) return null;
  const p = window.__contentDataPromise;
  window.__contentDataPromise = null;
  return p;
};

/**
 * Seed the in-memory cache with already-loaded content (SSR payload).
 * Returns true when the content was valid and adopted.
 */
export const seedContentCache = (data) => {
  if (!validateContent(data)) return false;
  contentCache = data;
  contentCacheTimestamp = Date.now();
  return true;
};

// Adopt the SSR-embedded payload as soon as this module loads, i.e. before
// hydrateRoot renders, so hooks can read it synchronously.
if (typeof window !== 'undefined' && window.__INITIAL_CONTENT__) {
  if (seedContentCache(window.__INITIAL_CONTENT__)) {
    // The bootstrap fetch is redundant now; drop it so it isn't adopted later
    window.__contentDataPromise = null;
  }
  window.__INITIAL_CONTENT__ = null;
}

/**
 * Synchronously read the cached content (or null). Ignores the TTL: callers
 * use it for the first render and revalidate separately via isContentFresh().
 */
export const peekContentData = () => contentCache;

export const isContentFresh = () =>
  !!contentCache && (Date.now() - contentCacheTimestamp) < CACHE_DURATION;

/**
 * Load contentData.json (deduplicated, cached for CACHE_DURATION).
 * Resolves to null on failure.
 */
export const loadContentData = () => {
  if (isContentFresh()) {
    return Promise.resolve(contentCache);
  }
  if (inflight) return inflight;

  const startedGeneration = generation;
  const promise = (async () => {
    try {
      let data = await (takeBootstrapPromise() || Promise.resolve(null)).catch(() => null);
      if (!validateContent(data)) {
        data = await fetchContentData();
      }
      if (!validateContent(data)) {
        throw new Error('Invalid content structure: missing required fields');
      }
      if (startedGeneration === generation) {
        contentCache = data;
        contentCacheTimestamp = Date.now();
        logger.info(CONTEXT, `Loaded contentData.json (${Object.keys(data).length} exports)`);
      } else {
        logger.debug(CONTEXT, 'Discarding contentData.json loaded before the cache was cleared');
      }
      return data;
    } catch (error) {
      logger.error(CONTEXT, 'Failed to load /data/contentData.json:', error);
      return null;
    } finally {
      if (inflight === promise) inflight = null;
    }
  })();
  inflight = promise;
  return promise;
};

/**
 * Clear the content cache to force reload
 */
export const clearContentCache = () => {
  generation += 1;
  contentCache = null;
  contentCacheTimestamp = 0;
  inflight = null;
  // A bootstrap fetch that hasn't been adopted yet may predate the change
  if (typeof window !== 'undefined') window.__contentDataPromise = null;
  logger.info(CONTEXT, 'Content cache cleared');
};

export default { loadContentData, clearContentCache, peekContentData, seedContentCache, isContentFresh };
