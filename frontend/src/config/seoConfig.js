/**
 * Meta for the static routes. Pages render it with <SEOHead {...SEO.pages.x} />.
 *
 * The Vite build also writes these pages to dist/seo-pages.json, from which
 * the backend prerenders each route's <head> and share card for crawlers
 * that don't run JavaScript (backend/services/seo_prerender.py). Product,
 * family and category pages build their meta in utils/seoSchema.js.
 *
 * Titles stay under ~60 characters and descriptions under ~158 so search
 * results don't cut them off.
 */
import { DEFAULT_SHARE_IMAGE, SITE_NAME, SITE_URL, shareImageUrl } from './site';

const pages = {
  home: {
    title: 'Commercial Restaurant Chairs, Barstools & Booths | Eagle Chair',
    description:
      'Family-owned Houston manufacturer of commercial chairs, barstools, booths and tables for restaurants, bars and hotels since 1984. Made to order.',
    url: '/',
  },
  products: {
    title: 'Commercial Seating & Furniture Catalog | Eagle Chair',
    description:
      'Browse commercial restaurant chairs, barstools, booths, tables and table bases from Eagle Chair. Built to order in Houston, TX. Request a quote.',
    url: '/products',
  },
  about: {
    title: 'About Eagle Chair | Family-Owned Seating Maker Since 1984',
    description:
      'Since 1984, family-owned Eagle Chair has built commercial chairs, barstools, booths and tables in Houston, TX for restaurants, bars and hotels.',
    url: '/about',
  },
  contact: {
    title: 'Contact Eagle Chair | Quotes & Dealer Inquiries',
    description:
      'Contact Eagle Chair in Houston, TX for quotes, product questions, samples and dealer inquiries about commercial restaurant and hospitality seating.',
    url: '/contact',
  },
  gallery: {
    title: 'Restaurant & Hospitality Installations | Eagle Chair',
    description:
      'See Eagle Chair commercial chairs, barstools, booths and tables installed in restaurants, bars and hotels.',
    url: '/gallery',
  },
  findARep: {
    title: 'Find a Sales Representative | Eagle Chair',
    description:
      'Find your local Eagle Chair sales representative for product guidance, samples and quotes on commercial restaurant and hospitality seating.',
    url: '/find-a-rep',
  },
  search: {
    title: 'Search Products | Eagle Chair',
    description: "Search Eagle Chair's catalog of commercial chairs, barstools, booths and tables.",
    url: '/search',
    // Internal search results shouldn't be indexed (Google guidance)
    noindex: true,
  },
  virtualCatalogs: {
    title: 'Product Catalogs & Brochures | Eagle Chair',
    description:
      "View and download Eagle Chair's full catalogs and collection brochures for commercial chairs, barstools, booths and tables.",
    url: '/virtual-catalogs',
  },
  woodFinishes: {
    title: 'Finishes: Wood Stains, Powder Coat & Chrome | Eagle Chair',
    description:
      'Wood stains plus powder coat and plated metal finishes for Eagle Chair commercial chairs, barstools, booths, tables and bases, with swatches for specifying your order.',
    url: '/resources/woodfinishes',
  },
  hardware: {
    title: 'Chair Hardware & Table Bases | Eagle Chair',
    description:
      'Glides, swivels, footrings and other chair hardware, plus table bases and edge profiles used on Eagle Chair products.',
    url: '/resources/hardware',
  },
  laminates: {
    title: 'Table Top Laminate Options | Eagle Chair',
    description:
      "Eagle Chair's laminate options for commercial table tops, with color and pattern swatches for restaurant and hospitality projects.",
    url: '/resources/laminates',
  },
  upholstery: {
    title: 'Upholstery & COM Fabric Options | Eagle Chair',
    description:
      'Vinyl and fabric upholstery options for Eagle Chair commercial seating. Customer-supplied (COM) material accepted.',
    url: '/resources/upholstery',
  },
  guides: {
    title: 'Layout, Installation & Care Guides | Eagle Chair',
    description:
      'Booth and table layout rules of thumb, seating height guidelines, base and glide installation, care instructions and warranty from Eagle Chair.',
    url: '/resources/guides',
  },
  specSheets: {
    title: 'Spec Sheets & Line Drawings | Eagle Chair',
    description:
      'Line sheets, spec sheets and line drawings for Eagle Chair commercial chairs, barstools, booths and tables, searchable by collection or model number.',
    url: '/resources/spec-sheets',
  },
  seatBackTerms: {
    title: 'Seat & Back Terminology Guide | Eagle Chair',
    description:
      'Reference guide to Eagle Chair seat and back styles and terms, for specifying and customizing commercial seating orders.',
    url: '/resources/seat-back-terms',
  },
  generalInfo: {
    title: 'General Information | Eagle Chair',
    description:
      'General information about Eagle Chair products, ordering, lead times, and commercial seating services.',
    url: '/general-information',
  },
  terms: {
    title: 'Terms of Service | Eagle Chair',
    description: 'Eagle Chair terms of service and conditions of use.',
    url: '/terms',
    noindex: true,
  },
  privacy: {
    title: 'Privacy Policy | Eagle Chair',
    description: 'Eagle Chair privacy policy: how we collect, use, and protect your information.',
    url: '/privacy',
    noindex: true,
  },
  cart: {
    title: 'Quote Cart | Eagle Chair',
    description: 'Review your selected Eagle Chair products and submit a quote request.',
    url: '/cart',
    noindex: true,
  },
  quoteRequest: {
    title: 'Request a Quote | Eagle Chair',
    description: 'Submit a quote request for commercial seating from Eagle Chair.',
    url: '/quote-request',
    noindex: true,
  },
  login: {
    title: 'Dealer Login | Eagle Chair',
    description: 'Log in to your Eagle Chair dealer account to manage quotes and orders.',
    url: '/login',
    noindex: true,
  },
  forgotPassword: {
    title: 'Forgot Password | Eagle Chair',
    description: 'Reset your Eagle Chair dealer account password.',
    url: '/forgot-password',
    noindex: true,
  },
  resetPassword: {
    title: 'Reset Password | Eagle Chair',
    description: 'Set a new password for your Eagle Chair dealer account.',
    url: '/reset-password',
    noindex: true,
  },
  emailVerification: {
    title: 'Verify Email | Eagle Chair',
    description: 'Verify your Eagle Chair dealer account email address.',
    url: '/verify-email',
    noindex: true,
  },
};

/** Card the backend renders for a static page: uploads/og/page/<path-with-dashes>.jpg */
export const pageShareSlug = (url) => url.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');

for (const page of Object.values(pages)) {
  page.image = page.url === '/' || page.noindex ? DEFAULT_SHARE_IMAGE : shareImageUrl('page', pageShareSlug(page.url));
}

export const SEO = {
  site: {
    name: SITE_NAME,
    url: SITE_URL,
    defaultImage: DEFAULT_SHARE_IMAGE,
    defaultDescription: pages.home.description,
  },
  pages,
};

export default SEO;
