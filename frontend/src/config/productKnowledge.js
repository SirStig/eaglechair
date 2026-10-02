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
  },
  {
    key: 'specs',
    name: 'Spec Sheets & Drawings',
    shortName: 'Spec Sheets',
    path: '/resources/spec-sheets',
    icon: FileText,
  },
  {
    key: 'guides',
    name: 'Installation & Care',
    path: '/resources/guides',
    icon: Wrench,
  },
  {
    key: 'finishes',
    name: 'Wood Finishes',
    path: '/resources/woodfinishes',
    icon: Palette,
  },
  {
    key: 'upholstery',
    name: 'Upholstery',
    path: '/resources/upholstery',
    icon: Spool,
  },
  {
    key: 'laminates',
    name: 'Laminates',
    path: '/resources/laminates',
    icon: Layers,
  },
  {
    key: 'hardware',
    name: 'Hardware & Bases',
    path: '/resources/hardware',
    icon: Cog,
  },
  {
    key: 'terms',
    name: 'Seat & Back Terms',
    shortName: 'Terminology',
    path: '/resources/seat-back-terms',
    icon: BookOpen,
  },
];

export const getKnowledgePage = (key) => PRODUCT_KNOWLEDGE_PAGES.find((p) => p.key === key);
