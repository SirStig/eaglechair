/**
 * Option group switches (upholstery / colors / laminates).
 *
 * A product switches a group on or off; a variation can override that with
 * true or false, and null/undefined follows the product.
 */
export const OPTION_GROUP_FIELDS = {
  upholstery: 'upholstery_enabled',
  colors: 'colors_enabled',
  laminates: 'laminates_enabled',
};

export function isOptionGroupEnabled(product, variation, group) {
  const field = OPTION_GROUP_FIELDS[group];
  const override = variation?.[field];
  if (override === true || override === false) return override;
  return product?.[field] !== false;
}

/** The options list for a group, or undefined when the group is switched off */
export function optionsIfEnabled(product, variation, group, options) {
  return isOptionGroupEnabled(product, variation, group) ? options : undefined;
}

// Supplier-link types that belong to a switchable option group
const SOURCE_GROUPS = { laminate: 'laminates', upholstery: 'upholstery' };

/**
 * Supplier catalogs ("special order from Wilsonart") of one material type for
 * a product, or undefined. Laminate and upholstery links follow the same
 * product / variation switches as those option groups.
 */
export function sourcesFor(product, variation, type) {
  const list = product?.customizations?.sources?.[type];
  if (!list?.length) return undefined;
  const group = SOURCE_GROUPS[type];
  return group ? optionsIfEnabled(product, variation, group, list) : list;
}

/** Whether a product has any supplier links showing for this variation */
export function hasAnySources(product, variation) {
  return ['laminate', 'upholstery', 'finish', 'hardware', 'other'].some((t) => sourcesFor(product, variation, t)?.length);
}

// Supplier link in either product-API (snake_case) or contentData (camelCase) shape
export const readSupplier = (source) => ({
  id: source.id,
  name: source.name,
  url: source.url,
  description: source.description,
  logoUrl: source.logoUrl ?? source.logo_url,
});
