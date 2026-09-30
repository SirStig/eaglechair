/**
 * Shared CMS content invalidation.
 *
 * Every useContent() instance subscribes to `version`. invalidateCmsContent()
 * drops the contentData.json cache and every cachedFetch key used by content
 * hooks, then bumps the version so all mounted hooks (Header, Footer, the
 * current page, ...) re-fetch - not just the one that triggered the save.
 *
 * Successful admin writes are reported here centrally by the API client
 * (see notifyAdminWrite), so no call site has to remember to invalidate.
 */

import { clearContentCache } from './contentDataLoader';
import { clearLegalDocumentsCache } from './legalDocumentsLoader';
import { deleteCacheKey } from './cache';
import logger from './logger';

const CONTEXT = 'CmsContentStore';

export const CMS_PUBLISH_FAILED_EVENT = 'cms:publish-failed';
export const CMS_PUBLISH_FAILED_MESSAGE =
  "Saved, but the live site couldn't be updated. Try Export All or contact support.";

let version = 0;
const listeners = new Set();
const trackedKeys = new Set();
let batchDepth = 0;
let pendingInvalidation = false;

/** Register a cachedFetch key that holds CMS-derived data */
export const trackCmsCacheKey = (key) => {
  if (key) trackedKeys.add(key);
};

export const getCmsContentVersion = () => version;

export const subscribeCmsContent = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Clear every public content cache and make all content hooks re-fetch.
 */
export const invalidateCmsContent = () => {
  if (batchDepth > 0) {
    pendingInvalidation = true;
    return;
  }
  clearContentCache();
  clearLegalDocumentsCache();
  trackedKeys.forEach((key) => deleteCacheKey(key));
  version += 1;
  logger.debug(CONTEXT, `CMS content invalidated (version ${version})`);
  listeners.forEach((listener) => {
    try {
      listener(version);
    } catch (error) {
      logger.error(CONTEXT, 'Invalidation listener failed', error);
    }
  });
};

/**
 * Run several writes and invalidate once at the end (e.g. reordering N items)
 * instead of once per write. On failure it always invalidates, so the UI
 * re-syncs with whatever the server actually saved.
 */
export const runCmsBatch = async (fn) => {
  batchDepth += 1;
  let failed = false;
  try {
    return await fn();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && (pendingInvalidation || failed)) {
      pendingInvalidation = false;
      invalidateCmsContent();
    }
  }
};

/**
 * True when a /cms-admin write saved to the DB but the backend could not
 * re-export contentData.json (contract: `exported: false`).
 */
export const isPublishFailed = (response) =>
  !!response && typeof response === 'object' && response.exported === false;

const notifyPublishFailed = (url) => {
  logger.warn(CONTEXT, `Saved but not published to contentData.json: ${url}`);
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CMS_PUBLISH_FAILED_EVENT, {
      detail: { url, message: CMS_PUBLISH_FAILED_MESSAGE },
    }));
  } catch {
    // CustomEvent unavailable - the logger warning above still records it
  }
};

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const ADMIN_WRITE_PATHS = ['/api/v1/cms-admin/', '/api/v1/admin/', '/api/v1/products'];

/**
 * Called by the API client after every successful response.
 * Mutations to admin/CMS endpoints invalidate the public content caches.
 */
export const notifyAdminWrite = (config, data) => {
  if (typeof window === 'undefined' || !config) return;
  const method = (config.method || 'get').toLowerCase();
  if (!MUTATING_METHODS.has(method)) return;
  const url = config.url || '';
  if (!ADMIN_WRITE_PATHS.some((p) => url.includes(p))) return;
  // Uploads and AI chat traffic don't change published content
  if (/\/upload|\/ai\//.test(url)) return;

  if (url.includes('/cms-admin/') && isPublishFailed(data)) {
    notifyPublishFailed(url);
  }
  invalidateCmsContent();
};
