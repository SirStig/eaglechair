/**
 * First-party, anonymous site analytics.
 *
 * Sends page views, product views, downloads, searches, quote-cart and form
 * activity, material / catalog interest and time on page to
 * POST /api/v1/analytics/events. Visitors are random ids kept in this browser
 * only (no cookies, no personal data). Events are batched and flushed with
 * fetch keepalive so they survive navigation and tab close. Only real public
 * pages are tracked (see analyticsRoutes.js).
 */

import { isPublicPage, normalizePath } from './analyticsRoutes';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ENDPOINT = `${API_BASE_URL}/api/v1/analytics/events`;
const VISITOR_KEY = 'ec_vid';
const SESSION_KEY = 'ec_sid';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 20;
const MAX_ENGAGED_SECONDS = 30 * 60;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

const DOWNLOAD_EXTENSIONS = /\.(pdf|dwg|dxf|skp|zip|rvt|rfa|step|stp|3ds|obj|fbx|ai|eps|doc|docx|xls|xlsx|csv|jpg|jpeg|png)(\?|#|$)/i;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

let queue = [];
let flushTimer = null;
const memoryStore = {};
let lastPageView = { path: null, at: 0 };

const randomId = () => {
  if (isBrowser && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const storageGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore[key] || null;
  }
};

const storageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStore[key] = value;
  }
};

const getVisitorId = () => {
  let id = storageGet(VISITOR_KEY);
  if (!id) {
    id = randomId();
    storageSet(VISITOR_KEY, id);
  }
  return id;
};

/** Returns { id, isNew }; a session ends after 30 minutes without events. */
const touchSession = () => {
  const now = Date.now();
  let session = null;
  try {
    session = JSON.parse(storageGet(SESSION_KEY) || 'null');
  } catch {
    session = null;
  }
  const isNew = !session?.id || now - (session.at || 0) > SESSION_IDLE_MS;
  const id = isNew ? randomId() : session.id;
  storageSet(SESSION_KEY, JSON.stringify({ id, at: now }));
  return { id, isNew };
};

/** Campaign tags (?utm_source=...) on the landing URL, if any. */
const campaignTags = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tags = {};
    UTM_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) tags[key] = value.slice(0, 150);
    });
    return tags;
  } catch {
    return {};
  }
};

const flush = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (queue.length) {
    const events = queue.splice(0, MAX_BATCH);
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Analytics must never affect the page
    }
  }
};

const scheduleFlush = () => {
  if (queue.length >= MAX_BATCH) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
  }
};

/** Queue any event type the backend accepts (see AnalyticsEventType). */
export const trackEvent = (type, data = {}) => {
  if (!isBrowser) return;
  const path = normalizePath(data.path ?? window.location.pathname);
  if (!isPublicPage(path)) return;

  const session = touchSession();
  const event = {
    type,
    visitor_id: getVisitorId(),
    session_id: session.id,
    // Only the landing page of a session carries the external referrer
    referrer: session.isNew ? document.referrer || null : null,
    ...data,
    path,
  };
  if (session.isNew && type === 'page_view') Object.assign(event, campaignTags());
  queue.push(event);
  scheduleFlush();
};

// ---------------------------------------------------------------------------
// Time on page: visible seconds and furthest scroll, reported when the page
// is left or the tab is hidden (possibly in pieces; the backend sums them)
// ---------------------------------------------------------------------------

const engagement = { path: null, visibleSince: null, ms: 0, depth: 0 };

const scrollDepth = () => {
  const doc = document.documentElement;
  if (doc.scrollHeight - window.innerHeight <= 0) return 100;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100));
};

const pauseEngagement = () => {
  if (engagement.visibleSince !== null) {
    engagement.ms += Date.now() - engagement.visibleSince;
    engagement.visibleSince = null;
  }
};

const reportEngagement = () => {
  pauseEngagement();
  const seconds = Math.min(Math.round(engagement.ms / 1000), MAX_ENGAGED_SECONDS);
  if (engagement.path && seconds >= 1) {
    trackEvent('engagement', { path: engagement.path, value: seconds, depth: engagement.depth });
  }
  engagement.ms = 0;
};

const startEngagement = (path) => {
  reportEngagement();
  engagement.path = path;
  engagement.depth = 0;
  engagement.visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  // Short pages are fully visible without scrolling; measure once rendered
  setTimeout(() => {
    if (engagement.path === path) engagement.depth = Math.max(engagement.depth, scrollDepth());
  }, 1500);
};

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export const trackPageView = (rawPath) => {
  if (!isBrowser) return;
  const path = normalizePath(rawPath);
  const now = Date.now();
  // StrictMode / duplicate effects fire twice for the same navigation
  if (lastPageView.path === path && now - lastPageView.at < 1000) return;
  lastPageView = { path, at: now };
  if (!isPublicPage(path)) {
    // Moving to an untracked page (404, admin) still ends the last page's visit
    reportEngagement();
    engagement.path = null;
    return;
  }
  startEngagement(path);
  trackEvent('page_view', { path });
};

export const trackProductView = (product) => {
  const productId = Number(product?.id);
  if (!productId) return;
  trackEvent('product_view', { product_id: productId, label: product.name || null });
};

/** One per settled query; resultCount = 0 flags a search that found nothing. */
export const trackSearch = (query, resultCount) => {
  const label = (query || '').trim();
  if (label.length < 2) return;
  trackEvent('search', {
    label: label.slice(0, 255),
    value: Number.isFinite(resultCount) ? resultCount : null,
  });
};

export const trackCartAdd = (product, quantity = 1) => {
  const productId = Number(product?.id);
  if (!productId) return;
  trackEvent('cart_add', { product_id: productId, label: product.name || null, value: Number(quantity) || 1 });
};

export const trackCartRemove = (product) => {
  const productId = Number(product?.id);
  if (!productId) return;
  trackEvent('cart_remove', { product_id: productId, label: product.name || null });
};

export const trackQuoteStart = () => trackEvent('quote_start');

export const trackQuoteSubmit = (itemCount) => trackEvent('quote_submit', { value: Number(itemCount) || 0 });

export const trackContactSubmit = (subject) => trackEvent('contact_submit', { label: subject || 'General' });

export const trackRepSearch = (region) => {
  if (!region) return;
  trackEvent('rep_search', { label: String(region).slice(0, 255) });
};

/** A finish, fabric, laminate or hardware item opened or enlarged. */
export const trackMaterialView = (materialType, name) => {
  if (!name) return;
  trackEvent('material_view', { resource_type: materialType, label: String(name).slice(0, 255) });
};

/**
 * Something done on a product page: an option picked, a tab opened, an
 * image viewed. `kind` groups them (finish, upholstery, variation, tab, image).
 */
export const trackProductInteraction = (productId, kind, label) => {
  const id = Number(productId);
  if (!id || !label) return;
  trackEvent('product_interaction', { product_id: id, resource_type: kind, label: String(label).slice(0, 255) });
};

/** Seconds a catalog or document was open in the on-site PDF viewer. */
export const trackCatalogRead = (title, seconds) => {
  const value = Math.min(Math.round(Number(seconds) || 0), MAX_ENGAGED_SECONDS);
  if (!title || value < 1) return;
  trackEvent('catalog_read', { label: String(title).slice(0, 255), value });
};

export const trackFilter = (facet, value) => {
  if (!facet || value === undefined || value === null || value === '') return;
  trackEvent('filter', { label: `${facet}: ${value}`.slice(0, 255) });
};

const fileNameFromUrl = (url) => {
  try {
    return decodeURIComponent(new URL(url, window.location.href).pathname.split('/').pop() || '') || null;
  } catch {
    return null;
  }
};

const inferResourceType = (url) => {
  const lower = (url || '').toLowerCase();
  if (/\.(dwg|dxf|skp|rvt|rfa|step|stp|3ds|obj|fbx)(\?|#|$)/.test(lower)) return 'cad';
  if (/\.(jpg|jpeg|png)(\?|#|$)/.test(lower)) return 'image';
  if (lower.includes('catalog')) return 'catalog';
  if (lower.includes('spec')) return 'spec_sheet';
  if (lower.includes('guide') || lower.includes('install')) return 'guide';
  return 'document';
};

/**
 * Record a download or document open.
 * @param {{url: string, label?: string, type?: string, productId?: number}} info
 */
export const trackDownload = ({ url, label, type, productId } = {}) => {
  if (!isBrowser || !url) return;
  let resourceUrl = url;
  try {
    // Store a stable path rather than a full CDN/media origin
    const parsed = new URL(url, window.location.href);
    resourceUrl = parsed.origin === window.location.origin ? parsed.pathname : `${parsed.host}${parsed.pathname}`;
  } catch {
    // keep as given
  }
  trackEvent('download', {
    resource_url: resourceUrl.slice(0, 512),
    resource_type: type || inferResourceType(url),
    label: (label || fileNameFromUrl(url) || resourceUrl).slice(0, 255),
    product_id: Number(productId) || null,
  });
};

let installed = false;

/**
 * Catches downloads anywhere on the site: links with a `download` attribute or
 * pointing at a document/CAD/image file. Links can refine what's recorded with
 * data-track-label, data-track-type and data-track-product, or opt out with
 * data-track-ignore (when the click is already tracked explicitly). Also keeps
 * the time-on-page clock in step with tab visibility and scrolling.
 */
export const installAnalytics = () => {
  if (!isBrowser || installed) return;
  installed = true;

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target?.closest?.('a[href]');
      if (!link || link.dataset.trackIgnore !== undefined) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const isDownload = link.hasAttribute('download') || link.dataset.trackType || DOWNLOAD_EXTENSIONS.test(href);
      if (!isDownload) return;
      trackDownload({
        url: link.href,
        label: link.dataset.trackLabel || link.getAttribute('download') || null,
        type: link.dataset.trackType || null,
        productId: link.dataset.trackProduct || null,
      });
    },
    true
  );

  let scrollQueued = false;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        if (engagement.path) engagement.depth = Math.max(engagement.depth, scrollDepth());
      });
    },
    { passive: true }
  );

  window.addEventListener('pagehide', () => {
    reportEngagement();
    flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportEngagement();
      flush();
    } else if (engagement.path && engagement.visibleSince === null) {
      engagement.visibleSince = Date.now();
    }
  });
};
