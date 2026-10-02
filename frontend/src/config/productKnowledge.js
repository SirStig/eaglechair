import {
  BookImage,
  FileText,
  Wrench,
  Palette,
  Spool,
  Layers,
  Cog,
  BookOpen,
} from 'lucide-react';

/**
 * Product Knowledge pages, in menu order. Used by the header dropdown, the mobile menu,
 * the footer and each page's "Related" strip so they never drift apart.
 */
export const PRODUCT_KNOWLEDGE_PAGES = [
  {
    key: 'catalogs',
    name: 'Catalogs',
    path: '/virtual-catalogs',
    icon: BookImage,
    blurb: 'Full catalogs and collection brochures',
  },
  {
    key: 'specs',
    name: 'Spec Sheets & Drawings',
    path: '/resources/spec-sheets',
    icon: FileText,
    blurb: 'Line sheets, spec sheets and line drawings by model',
  },
  {
    key: 'guides',
    name: 'Installation & Care',
    path: '/resources/guides',
    icon: Wrench,
    blurb: 'Layout rules, installation, care and warranty',
  },
  {
    key: 'finishes',
    name: 'Wood Finishes',
    path: '/resources/woodfinishes',
    icon: Palette,
    blurb: 'Stains and finishes by grade',
  },
  {
    key: 'upholstery',
    name: 'Upholstery',
    path: '/resources/upholstery',
    icon: Spool,
    blurb: 'Vinyls, leathers and COM',
  },
  {
    key: 'laminates',
    name: 'Laminates',
    path: '/resources/laminates',
    icon: Layers,
    blurb: 'Table top laminates',
  },
  {
    key: 'hardware',
    name: 'Hardware & Bases',
    path: '/resources/hardware',
    icon: Cog,
    blurb: 'Glides, swivels, footrings, table bases and edges',
  },
  {
    key: 'terms',
    name: 'Seat & Back Terms',
    path: '/resources/seat-back-terms',
    icon: BookOpen,
    blurb: 'Construction and style terminology',
  },
];

export const getKnowledgePage = (key) => PRODUCT_KNOWLEDGE_PAGES.find((p) => p.key === key);
