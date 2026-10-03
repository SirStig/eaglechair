import { CATALOG_TYPE_LABELS } from '../../utils/catalogTypes';

/** Formatting shared by the admin Analytics page and the dashboard overview. */

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n || 0);

export const RESOURCE_TYPE_LABELS = {
  ...CATALOG_TYPE_LABELS,
  catalog: 'Catalog',
  spec_sheet: 'Spec Sheet',
  line_drawing: 'Line Drawing',
  cad: 'CAD File',
  image: 'Product Image',
  guide: 'Guide',
  document: 'Document',
  other: 'Other',
};

export const humanizePath = (path) => (!path || path === '/' ? 'Home' : path);
