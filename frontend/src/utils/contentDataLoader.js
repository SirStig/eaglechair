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
    
    // Split by "export const" and parse each one
    const exportBlocks = jsCode.split(/export\s+const\s+(\w+)\s*=/);
    
    for (let i = 1; i < exportBlocks.length; i += 2) {
      const varName = exportBlocks[i];
      let varValueStr = exportBlocks[i + 1];
      
      // Find the semicolon that ends this export (not inside strings/objects/arrays)
      let braceDepth = 0;
      let bracketDepth = 0;
      let inString = false;
      let stringChar = null;
      let endIndex = 0;
      
      for (let j = 0; j < varValueStr.length; j++) {
        const char = varValueStr[j];
        const prevChar = j > 0 ? varValueStr[j - 1] : null;
        
        if (!inString) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
          else if (char === '[') bracketDepth++;
          else if (char === ']') bracketDepth--;
          else if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            inString = true;
            stringChar = char;
          } else if (char === ';' && braceDepth === 0 && bracketDepth === 0) {
            endIndex = j;
            break;
          }
        } else {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
            stringChar = null;
          }
        }
      }
      
      varValueStr = varValueStr.substring(0, endIndex).trim();
      
      try {
        // Use Function constructor instead of eval for better security
        // Creates a new execution context isolated from current scope
        const parseValue = new Function('return (' + varValueStr + ')');
        exports[varName] = parseValue();
        logger.debug(CONTEXT, `Parsed ${varName}: ${Array.isArray(exports[varName]) ? `${exports[varName].length} items` : 'object'}`);
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
