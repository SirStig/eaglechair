/**
 * Public origins used in SEO tags, structured data and share links.
 *
 * SITE_URL is the canonical origin (canonicals, og:url, JSON-LD).
 * MEDIA_BASE_URL serves the built frontend files and /uploads (share images
 * live in /uploads/og). Keep in sync with SITE_URL / MEDIA_BASE_URL in
 * backend/core/config.py; vite.config.js fills the same values into index.html.
 */
const trimSlash = (value) => value.replace(/\/+$/, '');

export const SITE_URL = trimSlash(import.meta.env?.VITE_SITE_URL || 'https://www.eaglechair.com');
export const MEDIA_BASE_URL = trimSlash(import.meta.env?.VITE_MEDIA_BASE_URL || 'https://joshua.eaglechair.com');

export const SITE_NAME = 'Eagle Chair';
export const DEFAULT_SHARE_IMAGE = `${MEDIA_BASE_URL}/og-image.jpg`;

/** Absolute canonical URL for an app path ("/products" -> "https://.../products"). */
export const absoluteUrl = (path = '/') => {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Absolute URL for a stored image ("/uploads/..." or already absolute). */
export const absoluteMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? url : `/uploads/${url}`}`;
};

/**
 * Share card rendered by the backend (services/seo_prerender.py) for a
 * product, family or category: kind is "product" | "family" | "category".
 */
export const shareImageUrl = (kind, slug) =>
  slug ? `${MEDIA_BASE_URL}/uploads/og/${kind}/${encodeURIComponent(slug)}.jpg` : DEFAULT_SHARE_IMAGE;
