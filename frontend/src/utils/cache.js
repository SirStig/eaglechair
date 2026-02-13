/**
 * Simple in-memory cache for API responses
 * Reduces unnecessary API calls for static content
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, value);
    this.timestamps.set(key, {
      created: Date.now(),
      ttl
    });
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if expired/not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    if (!timestamp) {
      return null;
    }

    // Check if expired
    if (Date.now() - timestamp.created > timestamp.ttl) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp.created > timestamp.ttl) {
        this.delete(key);
      }
    }
  }
}

// Create singleton instance
const cache = new Cache();

// Clear expired entries every minute
setInterval(() => {
  cache.clearExpired();
}, 60 * 1000);

export default cache;

/**
 * Helper function to wrap API calls with caching
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function that returns a promise
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<any>}
 */
export const cachedFetch = async (key, fetchFn, ttl) => {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const data = await fetchFn();
  cache.set(key, data, ttl);
  return data;
};

/**
 * Invalidate cache entries by pattern
 * @param {string} pattern - Pattern to match cache keys (supports wildcards)
 * @returns {number} Number of entries invalidated
 */
export const deleteCacheKey = (key) => {
  if (cache.cache.has(key)) {
    cache.delete(key);
    return 1;
  }
  return 0;
};

export const invalidateCache = (pattern) => {
  let count = 0;

  if (pattern === '*') {
    cache.clear();
    return cache.size();
  }

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

  const keysToDelete = [];
  for (const key of cache.cache.keys()) {
    if (regex.test(key)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => {
    cache.delete(key);
    count++;
  });

  return count;
};

