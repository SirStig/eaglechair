/**
 * Legal Documents Loader
 *
 * Legal documents are exported to /data/legalDocuments.json (separate from
 * contentData.json) because only the Terms, Privacy and General Information
 * pages need them. Concurrent callers share one request; the server sends
 * no-cache + ETag, so `cache: 'no-cache'` revalidates cheaply (304).
 *
 * Falls back to contentData.legalDocuments when the file isn't there yet
 * (e.g. backend not redeployed/re-exported), so deploy order doesn't matter.
 */

import logger from './logger';
import { loadContentData } from './contentDataLoader';

const CONTEXT = 'LegalDocumentsLoader';
const CACHE_DURATION = 60000; // 1 minute, same as contentDataLoader

let cache = null;
let cacheTimestamp = 0;
let inflight = null;

const fetchLegalDocuments = async () => {
  try {
    const response = await fetch('/data/legalDocuments.json', { cache: 'no-cache' });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.legalDocuments)) return data.legalDocuments;
    }
  } catch (error) {
    logger.warn(CONTEXT, 'Could not load /data/legalDocuments.json, using contentData', error);
  }
  const content = await loadContentData();
  return Array.isArray(content?.legalDocuments) ? content.legalDocuments : null;
};

/**
 * Load legal documents (deduplicated, cached for CACHE_DURATION).
 * Resolves to an array, or null if none could be loaded.
 */
export const loadLegalDocuments = () => {
  if (cache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return Promise.resolve(cache);
  }
  if (inflight) return inflight;

  inflight = fetchLegalDocuments()
    .then((docs) => {
      if (docs) {
        cache = docs;
        cacheTimestamp = Date.now();
      }
      return docs;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export default loadLegalDocuments;
