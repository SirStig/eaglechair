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
const inflightFetches = new Map();

// Bumped whenever a key is invalidated, so a request that was already in
// flight can't write its (stale) result back after the invalidation.
const keyGenerations = new Map();
let globalGeneration = 0;
const generationOf = (key) => `${globalGeneration}:${keyGenerations.get(key) || 0}`;

const bumpKey = (key) => {
  keyGenerations.set(key, (keyGenerations.get(key) || 0) + 1);
  // Later callers must start a fresh request rather than join the stale one
  inflightFetches.delete(key);
};

export const cachedFetch = async (key, fetchFn, ttl) => {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  // Share one request between concurrent callers (e.g. Header + Footer)
  if (inflightFetches.has(key)) {
    return inflightFetches.get(key);
  }
  const generation = generationOf(key);
  const promise = (async () => {
    try {
      const data = await fetchFn();
      if (generationOf(key) === generation) {
        cache.set(key, data, ttl);
      }
      return data;
    } finally {
      if (inflightFetches.get(key) === promise) {
        inflightFetches.delete(key);
      }
    }
  })();
  inflightFetches.set(key, promise);
  return promise;
};

/**
 * Read a cached value without fetching (null when missing/expired).
 */
export const peekCache = (key) => cache.get(key);

/**
 * Delete one cache key (and discard any in-flight result for it)
 * @returns {number} Number of entries invalidated
 */
export const deleteCacheKey = (key) => {
  bumpKey(key);
  if (cache.cache.has(key)) {
    cache.delete(key);
    return 1;
  }
  return 0;
};

/**
 * Invalidate cache entries by pattern
 * @param {string} pattern - Pattern to match cache keys (supports wildcards)
 * @returns {number} Number of entries invalidated
 */
export const invalidateCache = (pattern) => {
  let count = 0;

  if (pattern === '*') {
    count = cache.size();
    cache.clear();
    globalGeneration += 1;
    inflightFetches.clear();
    return count;
  }

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

  const keysToDelete = [];
  for (const key of cache.cache.keys()) {
    if (regex.test(key)) {
      keysToDelete.push(key);
    }
  }
  for (const key of [...inflightFetches.keys()]) {
    if (regex.test(key)) bumpKey(key);
  }

  keysToDelete.forEach(key => {
    bumpKey(key);
    cache.delete(key);
    count++;
  });

  return count;
};

