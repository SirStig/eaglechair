/**
 * Catalog/guide type metadata — mirrors backend CatalogType enum.
 * Single source for display labels and for deciding which page a document lives on:
 * every document is listed on exactly one Product Knowledge page.
 */

export const CATALOG_TYPE_LABELS = {
  full_catalog: 'Catalog',
  product_line: 'Line Sheet',
  price_list: 'Price List',
  specification_sheet: 'Spec Sheet',
  technical_drawing: 'Line Drawing',
  installation_guide: 'Installation Guide',
  care_guide: 'Care Guide',
  finish_guide: 'Finish Guide',
  upholstery_guide: 'Upholstery Guide',
  other: 'Reference',
};

/** Ordered list for admin selects. */
export const CATALOG_TYPE_OPTIONS = Object.entries(CATALOG_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

/** /virtual-catalogs */
export const CATALOG_PAGE_TYPES = ['full_catalog', 'price_list'];
/** /resources/spec-sheets */
export const SPEC_LIBRARY_TYPES = ['product_line', 'specification_sheet', 'technical_drawing'];
/** /resources/guides */
export const GUIDE_PAGE_TYPES = ['installation_guide', 'care_guide', 'other'];
/** Shown as downloads on the matching materials page. */
export const FINISH_GUIDE_TYPES = ['finish_guide'];
export const UPHOLSTERY_GUIDE_TYPES = ['upholstery_guide'];

export const getCatalogType = (item) => item?.catalogType || item?.catalog_type || null;

export const formatCatalogType = (type) => {
  if (!type) return '';
  return (
    CATALOG_TYPE_LABELS[type] ||
    String(type)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

/** Active documents whose type is in `types`, in CMS display order. */
export const filterByTypes = (catalogs, types) =>
  (catalogs || []).filter((c) => c.isActive !== false && types.includes(getCatalogType(c)));

export const isCatalogPageItem = (item) => CATALOG_PAGE_TYPES.includes(getCatalogType(item));
