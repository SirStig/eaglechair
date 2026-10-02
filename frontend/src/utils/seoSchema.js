/**
 * Titles, descriptions and JSON-LD for catalog pages.
 *
 * Mirrors the page builders in backend/services/seo_prerender.py, which
 * prerender the same pages for crawlers that don't run JavaScript. Keep the
 * two in step so a page's tags don't change when the app takes over.
 */
import { SITE_NAME, SITE_URL, absoluteMediaUrl, absoluteUrl } from '../config/site';
import { buildProductUrl } from './apiHelpers';
import { buildCatalogPath } from './catalogUrl';

const TITLE_MAX = 65;
const DESCRIPTION_MAX = 158;

export const cleanText = (value) =>
  typeof value === 'string' ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

const truncate = (text, max = DESCRIPTION_MAX) => {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[,;:\-–—\s]+$/, '')}…`;
};

const sentence = (text) => (!text || /[.!?…]$/.test(text) ? text : `${text}.`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "A | B | Eagle Chair", dropping trailing parts until it fits. */
export const composeTitle = (...parts) => {
  const kept = parts.filter(Boolean);
  while (kept.length > 1 && [...kept, SITE_NAME].join(' | ').length > TITLE_MAX) kept.pop();
  return [...kept, SITE_NAME].join(' | ');
};

export const breadcrumbSchema = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    item: absoluteUrl(path),
  })),
});

const categoryCrumbs = (category) => {
  const crumbs = [['Home', '/'], ['Products', '/products']];
  if (category && typeof category === 'object') {
    if (category.parent_slug) {
      crumbs.push([category.parent_name || category.parent_slug, buildCatalogPath(category.parent_slug)]);
      crumbs.push([category.name, buildCatalogPath(category.parent_slug, category.slug)]);
    } else if (category.slug) {
      crumbs.push([category.name, buildCatalogPath(category.slug)]);
    }
  }
  return crumbs;
};

const modelLabel = (product) => `${product.model_number || ''}${product.model_suffix || ''}`.trim();

const SPEC_FIELDS = [
  ['seat_height', 'Seat height'],
  ['seat_width', 'Seat width'],
  ['seat_depth', 'Seat depth'],
  ['arm_height', 'Arm height'],
  ['back_height', 'Back height'],
];

/**
 * SEO for a product page.
 * @param {object} product - Product from the API (category object included)
 * @param {string[]} images - Resolved image URLs, primary first
 * @param {object} [family] - The product's family, if loaded
 */
export const productSeo = (product, images = [], family = null) => {
  const name = cleanText(product.name) || `Model ${product.model_number}`;
  const model = modelLabel(product);
  const category = typeof product.category === 'object' ? product.category : null;
  const categoryName = category?.name || null;
  const path = buildProductUrl(product);
  const nameHasModel = !model || name.toLowerCase().includes(model.toLowerCase());

  const title =
    cleanText(product.meta_title) || composeTitle(nameHasModel ? name : `${name}, Model ${model}`, categoryName);

  const summary = cleanText(product.short_description) || cleanText(product.full_description);
  let description;
  if (cleanText(product.meta_description)) {
    description = truncate(cleanText(product.meta_description));
  } else {
    const lead = summary ? sentence(summary) : `${name} by ${SITE_NAME}.`;
    const context = model
      ? `Model ${model} commercial ${categoryName ? categoryName.toLowerCase() : 'seating'}, made to order. Request a quote.`
      : 'Made to order. Request a quote.';
    description = truncate(lead.length < 100 ? `${lead} ${context}` : lead);
  }

  const crumbs = [...categoryCrumbs(category), [name, path]];
  const full = cleanText(product.full_description) || summary;

  const additionalProperty = [];
  for (const [key, label] of SPEC_FIELDS) {
    if (product[key] > 0) {
      additionalProperty.push({ '@type': 'PropertyValue', name: label, value: product[key], unitCode: 'INH' });
    }
  }
  if (product.upholstery_amount > 0) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'COM yardage', value: product.upholstery_amount, unitCode: 'YRD' });
  }
  if (product.stock_status) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Availability', value: product.stock_status });
  }

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${absoluteUrl(path)}#product`,
    name,
    url: absoluteUrl(path),
    description: truncate(full || description, 4900),
    image: images.slice(0, 6).map(absoluteMediaUrl).filter(Boolean),
    sku: model || String(product.id),
    mpn: model || undefined,
    model: model || undefined,
    brand: { '@type': 'Brand', name: SITE_NAME },
    manufacturer: { '@id': `${SITE_URL}/#organization` },
    category: categoryName || undefined,
    material: cleanText(product.frame_material) || undefined,
  };
  for (const key of ['width', 'depth', 'height']) {
    if (product[key] > 0) productSchema[key] = { '@type': 'QuantitativeValue', value: product[key], unitCode: 'INH' };
  }
  if (product.weight > 0) productSchema.weight = { '@type': 'QuantitativeValue', value: product.weight, unitCode: 'LBR' };
  if (additionalProperty.length) productSchema.additionalProperty = additionalProperty;
  if (family?.slug) {
    productSchema.isRelatedTo = { '@type': 'ProductGroup', name: family.name, url: absoluteUrl(`/families/${family.slug}`) };
  }

  return {
    path,
    title,
    description,
    imageAlt: `${name}${nameHasModel ? '' : ` (Model ${model})`} by ${SITE_NAME}`,
    // JSON round-trip drops the undefined optional fields
    structuredData: [JSON.parse(JSON.stringify(productSchema)), breadcrumbSchema(crumbs)],
  };
};

const memberKinds = (members) => [
  ...new Set(
    members
      .map((m) => (typeof m.category === 'object' ? m.category?.name : m.category))
      .filter((kind) => typeof kind === 'string' && kind)
  ),
];

/** SEO for a product family page; members come from /families/{id}/members. */
export const familySeo = (family, members = []) => {
  const name = cleanText(family.name);
  const heading = /\b(collection|series|family)\b/i.test(name) ? name : `${name} Collection`;
  const path = `/families/${family.slug}`;
  const kinds = memberKinds(members);
  const summary = cleanText(family.description) || cleanText(family.overview_text);
  const kindsText = kinds.length ? kinds.map((k) => k.toLowerCase()).join(', ') : 'commercial seating';
  const description = truncate(
    summary ||
      (members.length
        ? `The ${name} from ${SITE_NAME}: ${plural(members.length, 'model')} of ${kindsText} for restaurants, bars and hospitality. Made to order in Houston, TX. Request a quote.`
        : `The ${name} from ${SITE_NAME}. Commercial seating made to order in Houston, TX. Request a quote.`)
  );
  return {
    path,
    heading,
    title: composeTitle(heading, family.category_name),
    description,
    imageAlt: `${heading} by ${SITE_NAME}`,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absoluteUrl(path),
        name: heading,
        url: absoluteUrl(path),
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: members.length,
          itemListElement: members.slice(0, 120).map((m, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: cleanText(m.name),
          })),
        },
      },
      breadcrumbSchema([['Home', '/'], ['Products', '/products'], [heading, path]]),
    ],
  };
};

/** SEO for a category / subcategory listing page. */
export const categorySeo = (category, parent) => {
  const name = cleanText(category.name);
  const path = parent ? buildCatalogPath(parent.slug, category.slug) : buildCatalogPath(category.slug);
  const summary = cleanText(category.description);
  const description = cleanText(category.meta_description)
    ? truncate(cleanText(category.meta_description))
    : truncate(
        `${summary ? `${sentence(summary)} ` : ''}Browse commercial ${name.toLowerCase()} from ${SITE_NAME}, made to order in Houston, TX since 1984. Request a quote.`
      );
  const crumbs = [['Home', '/'], ['Products', '/products']];
  if (parent) crumbs.push([parent.name, buildCatalogPath(parent.slug)]);
  crumbs.push([name, path]);
  return {
    path,
    title: cleanText(category.meta_title) || composeTitle(`Commercial ${name}`),
    description,
    imageAlt: `${name} by ${SITE_NAME}`,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absoluteUrl(path),
        name,
        url: absoluteUrl(path),
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      breadcrumbSchema(crumbs),
    ],
  };
};

/**
 * Organization + WebSite for the home page, from CMS site settings. index.html
 * carries a minimal copy under the same @ids for every other page.
 */
export const organizationSchema = (settings = {}, description) => {
  const sameAs = [settings.facebookUrl, settings.instagramUrl, settings.linkedinUrl, settings.twitterUrl, settings.youtubeUrl]
    .filter((url) => typeof url === 'string' && /^https?:\/\//.test(url));
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: settings.companyName || SITE_NAME,
    legalName: 'Eagle Chair, Inc.',
    url: `${SITE_URL}/`,
    logo: absoluteMediaUrl(settings.logoUrl) || absoluteMediaUrl('/assets/eagle-chair-logo.png'),
    description,
    foundingDate: '1984',
    slogan: settings.companyTagline || undefined,
    email: settings.primaryEmail || undefined,
    telephone: settings.primaryPhone || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  if (settings.addressLine1) {
    organization.address = {
      '@type': 'PostalAddress',
      streetAddress: [settings.addressLine1, settings.addressLine2].filter(Boolean).join(', '),
      addressLocality: settings.city || undefined,
      addressRegion: settings.state || undefined,
      postalCode: settings.zipCode || undefined,
      addressCountry: 'US',
    };
  }
  if (settings.salesPhone || settings.primaryPhone) {
    organization.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: settings.salesPhone || settings.primaryPhone,
      email: settings.salesEmail || undefined,
      areaServed: 'US',
      availableLanguage: 'English',
    };
  }
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
  return [JSON.parse(JSON.stringify(organization)), website];
};
