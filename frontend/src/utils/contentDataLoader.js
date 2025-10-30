/**
 * Content Data Dynamic Loader
 * 
 * Loads contentData.js from /data/ at runtime with cache busting
 * This prevents Vite from bundling it, allowing the backend to update it
 * without requiring a frontend rebuild.
 */

import logger from './logger';

const CONTEXT = 'ContentDataLoader';

let contentCache = null;
let contentCacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Load contentData.js dynamically from public/data/
 * Uses fetch with cache-busting timestamp
 */
export const loadContentData = async () => {
  const now = Date.now();
  
  // Return cached if fresh
  if (contentCache && (now - contentCacheTimestamp) < CACHE_DURATION) {
    return contentCache;
  }
  
  try {
    // Fetch with cache-busting timestamp
    const timestamp = now;
    const response = await fetch(`/data/contentData.js?t=${timestamp}`, {
      cache: 'no-store', // Never cache
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const jsCode = await response.text();
    
    // Parse the ES6 module exports
    const exports = {};
    
    // Simple regex to extract exports
    // Matches: export const varName = value;
    const exportRegex = /export\s+const\s+(\w+)\s*=\s*(.+?);(?=\n\nexport|\n\n\/\/|$)/gs;
    let match;
    
    while ((match = exportRegex.exec(jsCode)) !== null) {
      const [, varName, varValue] = match;
      try {
        // eslint-disable-next-line no-eval
        exports[varName] = eval(`(${varValue})`);
      } catch (e) {
        logger.error(CONTEXT, `Failed to parse ${varName}:`, e);
      }
    }
    
    contentCache = exports;
    contentCacheTimestamp = now;
    
    logger.info(CONTEXT, `Loaded contentData.js (${Object.keys(exports).length} exports)`);
    return exports;
    
  } catch (error) {
    logger.error(CONTEXT, 'Failed to load /data/contentData.js:', error);
    return null;
  }
};

/**
 * Clear the content cache to force reload
 */
export const clearContentCache = () => {
  contentCache = null;
  contentCacheTimestamp = 0;
  logger.info(CONTEXT, 'Content cache cleared');
};

export default { loadContentData, clearContentCache };
