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
