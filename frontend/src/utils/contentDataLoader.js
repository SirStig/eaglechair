/**
 * Content Data Dynamic Loader
 * 
 * Loads contentData.json from /data/ at runtime with cache busting
 * This prevents Vite from bundling it, allowing the backend to update it
 * without requiring a frontend rebuild.
 * 
 * Uses JSON format instead of JS exports for security (no Function constructor/eval)
 */

import logger from './logger';

const CONTEXT = 'ContentDataLoader';

let contentCache = null;
let contentCacheTimestamp = 0;
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

/**
 * Load contentData.json dynamically from /data/ path
 * In development: served from public/data/contentData.json
 * In production: served from root-level /data/contentData.json
 * Uses fetch with cache-busting timestamp
 */
export const loadContentData = async () => {
  const now = Date.now();
  
  // Return cached if fresh
  if (contentCache && (now - contentCacheTimestamp) < CACHE_DURATION) {
    return contentCache;
  }
  
  try {
    // Try JSON format first (new secure format)
    const timestamp = now;
    let response = await fetch(`/data/contentData.json?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    // Fallback to .js for backward compatibility during migration
    if (!response.ok) {
      logger.debug(CONTEXT, 'contentData.json not found, trying contentData.js for backward compatibility');
      response = await fetch(`/data/contentData.js?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Legacy JS format - parse exports (temporary during migration)
      const jsCode = await response.text();
      const exports = {};
      const exportBlocks = jsCode.split(/export\s+const\s+(\w+)\s*=/);
      
      for (let i = 1; i < exportBlocks.length; i += 2) {
        const varName = exportBlocks[i];
        let varValueStr = exportBlocks[i + 1];
        
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
          const parseValue = new Function('return (' + varValueStr + ')');
          exports[varName] = parseValue();
          logger.debug(CONTEXT, `Parsed ${varName} (legacy JS format)`);
        } catch (e) {
          logger.error(CONTEXT, `Failed to parse ${varName}:`, e);
        }
      }
      
      if (!validateContent(exports)) {
        throw new Error('Invalid content structure');
      }
      
      contentCache = exports;
      contentCacheTimestamp = now;
      logger.info(CONTEXT, `Loaded contentData.js (legacy format, ${Object.keys(exports).length} exports)`);
      return exports;
    }
    
    // JSON format (secure)
    const jsonData = await response.json();
    
    if (!validateContent(jsonData)) {
      throw new Error('Invalid content structure: missing required fields');
    }
    
    contentCache = jsonData;
    contentCacheTimestamp = now;
    
    logger.info(CONTEXT, `Loaded contentData.json (${Object.keys(jsonData).length} exports)`);
    return jsonData;
    
  } catch (error) {
    logger.error(CONTEXT, 'Failed to load /data/contentData.json:', error);
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
