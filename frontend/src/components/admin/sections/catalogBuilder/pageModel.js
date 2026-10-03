/**
 * Catalog Builder page model: page types, their defaults and limits.
 * Mirrors backend/api/v1/schemas/catalog_builder.py and the layouts in
 * backend/services/catalog_pdf/layouts.py.
 */
import { Armchair, BookOpen, Columns3, Image as ImageIcon, LayoutGrid, ListOrdered, Package, Table2 } from 'lucide-react';

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

/** [width, height] of a page in PDF points: photo pages can be landscape (see layouts.page_size). */
export const pageSize = (page) => (
  page?.type === 'photo' && page.orientation === 'landscape' ? [PAGE_HEIGHT, PAGE_WIDTH] : [PAGE_WIDTH, PAGE_HEIGHT]
);

export const PAGE_TYPES = {
  cover: {
    label: 'Cover',
    icon: BookOpen,
    maxItems: 8,
    description: 'Headline, up to 8 products with model labels and the eagle between two taglines.',
  },
  toc: {
    label: 'Contents',
    icon: ListOrdered,
    maxItems: 0,
    description: 'Page list with model numbers, numbered automatically.',
  },
  product: {
    label: 'Product sheet',
    icon: Package,
    maxItems: 5,
    description: 'Family title, 1-5 products each with its spec column, and the Features / Materials panel (add a Sizes column for booths).',
  },
  gallery: {
    label: 'Variations',
    icon: LayoutGrid,
    maxItems: 8,
    description: 'Up to 8 captioned photos and a tagline banner.',
  },
  photo: {
    label: 'Photo',
    icon: ImageIcon,
    maxItems: 0,
    description: 'One full-bleed install photo, portrait or landscape.',
  },
  seats: {
    label: 'Seat options',
    icon: Armchair,
    maxItems: 10,
    description: 'Up to 10 seat close-ups in ovals with a code and description (P, PF, 22BX…), and a tagline banner.',
  },
  bases: {
    label: 'Table bases',
    icon: Columns3,
    maxItems: 12,
    description: 'Up to 12 captioned bases with a Sizes / Weight table and notes in the panel.',
  },
  chart: {
    label: 'Chart',
    icon: Table2,
    maxItems: 0,
    description: 'A ruled table, e.g. the table top / base compatibility chart, and a tagline banner.',
  },
};

/** Page types whose items list their model numbers in the contents (see renderer.TOC_MODEL_TYPES). */
export const TOC_MODEL_TYPES = ['product', 'bases'];

/** Which inspector tabs a page type has (Page / Products / Text). */
export const inspectorTabs = (type) => {
  const tabs = [{ id: 'page', label: 'Page' }];
  if (PAGE_TYPES[type]?.maxItems > 0) tabs.push({ id: 'products', label: 'Products' });
  if (type === 'product' || type === 'bases') tabs.push({ id: 'text', label: 'Text' });
  if (type === 'bases' || type === 'chart') tabs.push({ id: 'table', label: 'Table' });
  return tabs;
};

export const EMBLEMS = [
  { value: 'none', label: 'None' },
  { value: 'flag', label: 'Flag eagle' },
  { value: 'made_in_usa', label: 'Made in USA' },
];

export const DEFAULT_SETTINGS = {
  title: '',
  copyright: 'All Rights Reserved © Copyright Eagle Chair Inc. 1984 - {year}',
  page_numbers: true,
};

const newId = () => Math.random().toString(36).slice(2, 14);

const BASE = {
  title: '',
  subtitle: '',
  toc_label: null,
  include_in_toc: true,
  items: [],
  features: '',
  materials: '',
  environmental: '',
  standard: '',
  options: '',
  ip_text: '',
  emblem: 'none',
  sizes: '',
  sizes_label: '',
  table_header: [],
  table_rows: [],
  tagline: '',
  tagline_right: '',
  year: '',
  website: '',
  image_url: null,
  caption: '',
  dx: 0,
  dy: 0,
  scale: 1,
  show_footer: false,
  orientation: 'portrait',
};

export const newPage = (type) => {
  const page = { ...BASE, id: newId(), type };
  if (type === 'cover') {
    Object.assign(page, {
      title: 'New Traditions',
      subtitle: 'Eagle Chair Inc.',
      year: String(new Date().getFullYear()),
      tagline: 'Built to last',
      tagline_right: 'Designed to impress',
      website: 'www.eaglechair.com',
    });
  }
  if (type === 'toc') Object.assign(page, { title: 'Contents', tagline: 'Diverse concepts, unvarying quality' });
  if (type === 'gallery') Object.assign(page, { subtitle: 'variations', tagline: 'Your imagination is the only limitation on what we can build for you.' });
  if (type === 'seats') {
    Object.assign(page, {
      subtitle: 'upholstery',
      tagline: 'Eagle Chair provides one of the widest selections of upholstered seat types on all of our chairs.\nAnd even those can be further customized by several factors.',
    });
  }
  if (type === 'bases') Object.assign(page, { subtitle: 'table bases', environmental: 'High content of recycled iron and fully recyclable.' });
  if (type === 'chart') {
    Object.assign(page, {
      subtitle: 'table top compatibility chart',
      table_header: ['Table top\nsize', 'Table base\nmodel'],
      tagline: 'Please contact the factory if you are uncertain of the base sizes needed for your project.',
    });
  }
  return page;
};

/** Pages from the server (suggestions) get fresh ids and every field. */
export const normalizePage = (page) => ({ ...BASE, ...page, id: page.id || newId() });

export const duplicatePage = (page) => ({ ...JSON.parse(JSON.stringify(page)), id: newId() });

export const newItem = (fields = {}) => ({
  product_id: null,
  variation_id: null,
  image_url: null,
  caption: null,
  show_specs: true,
  dx: 0,
  dy: 0,
  scale: 1,
  ...fields,
});

export const modelLabel = (product, variation) => {
  if (variation?.sku) return variation.sku;
  if (!product) return '';
  return [product.model_number, product.model_suffix].filter(Boolean).join(' ');
};

/** Seat option caption when none is set (see layouts.seat_caption): "P - Padded seat". */
export const seatCaption = (product, variation) => {
  const label = modelLabel(product, variation);
  const name = variation?.name || '';
  return label && name ? `${label} - ${name}` : label || name;
};

/** Chart / sizes table rows <-> text: one row per line, cells split by tabs (pasted from Excel) or "|". */
export const rowsToText = (rows) => (rows || []).map((row) => row.join(' | ')).join('\n');
export const textToRows = (text) => text
  .split('\n')
  .filter((line) => line.trim())
  .slice(0, 120)
  .map((line) => line.split(line.includes('\t') ? '\t' : '|').slice(0, 6).map((cell) => cell.trim().slice(0, 60)));

/** The caption the PDF prints when none is set (see layouts.default_caption). */
export const defaultCaption = (product, variation) => {
  const first = `${modelLabel(product, variation)} ${product?.family_name || ''}`.trim();
  const second = variation?.name || (product?.family_name ? '' : product?.name) || '';
  return [first, second].filter(Boolean).join('\n');
};

export const pageSummary = (page) => {
  const meta = PAGE_TYPES[page.type];
  return page.title || (page.type === 'photo' ? (page.caption || 'Photo') : meta?.label) || page.type;
};

/** Ids of every product / variation the document refers to. */
export const referencedIds = (pages) => {
  const products = new Set();
  const variations = new Set();
  pages.forEach((page) => (page.items || []).forEach((item) => {
    if (item.product_id) products.add(item.product_id);
    if (item.variation_id) variations.add(item.variation_id);
  }));
  return { products, variations };
};

// Fields of the other pages that page numbering and the contents depend on
const NUMBERING_FIELDS = ['id', 'type', 'title', 'toc_label', 'include_in_toc'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/**
 * The smallest document that renders page `index` exactly like the full one.
 *
 * The page itself is sent whole; every other page only keeps what page
 * numbering and the contents need. A contents page also needs the model
 * numbers of the product sheets it lists. So editing text on one page doesn't
 * change (or re-render) the preview of another, and requests stay small.
 */
export const previewPayload = (document, index) => {
  const target = document.pages[index];
  const isToc = target?.type === 'toc';
  return {
    settings: document.settings,
    pages: document.pages.map((page, i) => {
      if (i === index) return page;
      const slim = pick(page, NUMBERING_FIELDS);
      if (isToc && TOC_MODEL_TYPES.includes(page.type)) {
        slim.items = (page.items || []).map((item) => ({ product_id: item.product_id, variation_id: item.variation_id }));
      }
      return slim;
    }),
  };
};
