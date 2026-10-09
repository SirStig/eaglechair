/**
 * Where to edit a record that uses a media file, by backend model name.
 * Admin sections open in the panel; site content (edited in place on the
 * public pages) opens the page that shows it in a new tab.
 */
const ADMIN = {
  Chair: (id) => `/admin/catalog?edit=${id}`,
  ProductVariation: () => '/admin/catalog',
  ProductImage: () => '/admin/catalog',
  ProductFamily: () => '/admin/families',
  Category: () => '/admin/categories',
  ProductSubcategory: () => '/admin/categories',
  Finish: () => '/admin/finishes',
  Color: () => '/admin/colors',
  Upholstery: () => '/admin/upholstery',
  Laminate: () => '/admin/laminates',
  Hardware: () => '/admin/hardware',
  MaterialSource: () => '/admin/supplier-links',
  Catalog: () => '/admin/resources/catalogs',
  CatalogProject: () => '/admin/catalog-builder',
  LegalDocument: () => '/admin/legal-documents',
  EmailTemplate: () => '/admin/emails',
  SiteSettings: () => '/admin/settings',
  Company: () => '/admin/companies',
  Quote: () => '/admin/quotes',
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
