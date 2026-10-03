/**
 * Public pages the analytics tracker records. Anything else (the 404 page,
 * scanner probes like /wp-login.php or /.env, admin pages) is never sent.
 * Mirror of PUBLIC_PAGES / DYNAMIC_ROUTES in backend/services/analytics_pages.py;
 * keep both in step with the public routes in App.jsx.
 */

const STATIC_PAGES = new Set([
  '/',
  '/products',
  '/search',
  '/gallery',
  '/about',
  '/contact',
  '/find-a-rep',
  '/virtual-catalogs',
  '/resources/guides',
  '/resources/spec-sheets',
  '/resources/woodfinishes',
  '/resources/hardware',
  '/resources/laminates',
  '/resources/upholstery',
  '/resources/seat-back-terms',
  '/general-information',
  '/cart',
  '/quote-request',
  '/terms',
  '/privacy',
]);

const SEG = '[A-Za-z0-9][A-Za-z0-9_-]{0,199}';

const DYNAMIC_ROUTES = [
  new RegExp(`^/products/category/${SEG}(/${SEG})?$`),
  new RegExp(`^/products/${SEG}/related$`),
  new RegExp(`^/products/${SEG}/${SEG}/${SEG}$`),
  new RegExp(`^/products/${SEG}$`),
  new RegExp(`^/families/${SEG}$`),
];

/** Same normalisation as the backend: no query/fragment, no trailing slash. */
export const normalizePath = (path) => {
  if (!path) return null;
  let clean = path.split('?')[0].split('#')[0];
  if (clean.length > 1) clean = clean.replace(/\/+$/, '');
  return clean || '/';
};

export const isPublicPage = (path) => {
  const clean = normalizePath(path);
  if (!clean) return false;
  return STATIC_PAGES.has(clean) || DYNAMIC_ROUTES.some((re) => re.test(clean));
};
