/**
 * Defers product-card hover/angle images until the main images are done.
 *
 * A card counts as "loading" while its main image is near the viewport and
 * not loaded yet. Queued hover preloads run once the page has loaded and no
 * card is loading, so angle shots never compete with the images people are
 * actually looking at.
 */

const loadingMains = new Set();
const queue = new Set();
let flushTimer = null;

const idle = (cb) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 1);

const scheduleFlush = () => {
  if (typeof window === 'undefined') return;
  clearTimeout(flushTimer);
  // Short settle delay: a scroll usually brings several new mains in at once
  flushTimer = setTimeout(() => {
    if (loadingMains.size > 0 || queue.size === 0) return;
    if (document.readyState !== 'complete') {
      window.addEventListener('load', scheduleFlush, { once: true });
      return;
    }
    const run = [...queue];
    queue.clear();
    idle(() => run.forEach((cb) => cb()));
  }, 250);
};

export const markMainLoading = (id) => {
  loadingMains.add(id);
};

export const markMainSettled = (id) => {
  if (loadingMains.delete(id)) scheduleFlush();
};

/** Queue `cb` to run once main images are idle. Returns a cancel function. */
export const whenMainImagesIdle = (cb) => {
  queue.add(cb);
  scheduleFlush();
  return () => queue.delete(cb);
};
