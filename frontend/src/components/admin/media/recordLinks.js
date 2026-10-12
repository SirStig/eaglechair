/**
 * Where to edit a record that uses a media file, by backend model name.
 * Admin sections open in the panel; site content (edited in place on the
 * public pages) opens the page that shows it in a new tab.
 */
const ADMIN = {
  Chair: (id) => `/admin/catalog?edit=${id}`,
  ProductVariation: () => '/admin/catalog',
  ProductImage: () => '/admin/catalog',
  ProductFamily: (id) => `/admin/families?family=${id}`,
  Category: (id) => `/admin/categories?category=${id}`,
  ProductSubcategory: (id) => `/admin/categories?subcategory=${id}`,
  Finish: (id) => `/admin/finishes?finish=${id}`,
  Color: (id) => `/admin/colors?color=${id}`,
  Upholstery: (id) => `/admin/upholstery?upholstery=${id}`,
  Laminate: (id) => `/admin/laminates?laminate=${id}`,
  Hardware: (id) => `/admin/hardware?hardware=${id}`,
  MaterialSource: (id) => `/admin/supplier-links?link=${id}`,
  Catalog: (id) => `/admin/resources/catalogs?catalog=${id}`,
  CatalogProject: (id) => `/admin/catalog-builder?catalog=${id}`,
  LegalDocument: (id) => `/admin/legal-documents?doc=${id}`,
  EmailTemplate: (id) => `/admin/emails?template=${id}`,
  SiteSettings: () => '/admin/settings',
  Company: (id) => `/admin/companies?company=${id}`,
  Quote: (id) => `/admin/quotes?quote=${id}`,
  QuoteItem: () => '/admin/quotes',
};

const PUBLIC = {
  HeroSlide: '/',
  ClientLogo: '/',
  Testimonial: '/',
  Feature: '/',
  TeamMember: '/about',
  CompanyInfo: '/about',
  CompanyValue: '/about',
  CompanyMilestone: '/about',
  Installation: '/gallery',
  ContactLocation: '/contact',
  SalesRepresentative: '/find-a-rep',
};

/** { href, external } for a usage ({ model, id }), or null when there's no editor for it. */
export function recordLink(usage) {
  if (ADMIN[usage.model]) return { href: ADMIN[usage.model](usage.id), external: false };
  if (PUBLIC[usage.model]) return { href: PUBLIC[usage.model], external: true };
  return null;
}

/** "primary_image_url" -> "primary image" */
export const fieldLabel = (field) => field.replace(/_url$/, '').replace(/_/g, ' ');
