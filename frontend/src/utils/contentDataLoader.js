/**
 * Content Data Dynamic Loader
 *
 * Loads contentData.json from /data/ at runtime. This prevents Vite from
 * bundling it, allowing the backend to update it without a frontend rebuild.
 *
 * Every caller on a page shares one request: index.html starts the fetch
 * before the bundle loads (window.__contentDataPromise) and the first
 * loadContentData() call adopts it. The server sends no-cache + ETag, so
 * `cache: 'no-cache'` revalidates cheaply (304) instead of re-downloading.
 */

import logger from './logger';

const CONTEXT = 'ContentDataLoader';

let contentCache = null;
let contentCacheTimestamp = 0;
let inflight = null;
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
 * Load contentData.json (deduplicated, cached for CACHE_DURATION).
 * Resolves to null on failure.
 */
export const loadContentData = () => {
  if (contentCache && (Date.now() - contentCacheTimestamp) < CACHE_DURATION) {
    return Promise.resolve(contentCache);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      let data = await (takeBootstrapPromise() || Promise.resolve(null)).catch(() => null);
      if (!validateContent(data)) {
        data = await fetchContentData();
      }
      if (!validateContent(data)) {
        throw new Error('Invalid content structure: missing required fields');
      }
      contentCache = data;
      contentCacheTimestamp = Date.now();
      logger.info(CONTEXT, `Loaded contentData.json (${Object.keys(data).length} exports)`);
      return data;
    } catch (error) {
      logger.error(CONTEXT, 'Failed to load /data/contentData.json:', error);
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

/**
 * Clear the content cache to force reload
 */
export const clearContentCache = () => {
  contentCache = null;
  contentCacheTimestamp = 0;
  inflight = null;
  logger.info(CONTEXT, 'Content cache cleared');
};

export default { loadContentData, clearContentCache };
