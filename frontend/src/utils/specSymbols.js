/**
 * Catalog spec symbols (the small diagrams printed next to dimensions in the
 * product catalogs) for product pages and quick view.
 *
 * Which drawings a product gets depends on its spec profile, set per category
 * or subcategory in the admin (`spec_profile`; null inherits from the parent).
 * Fields without a drawing for that profile show a short text badge instead.
 * The SVGs live in public/assets/spec-icons/.
 */
import { findCategoryById, findNestedCategoryById, getChildren, isNestedCategoryChild } from './categoryTree';

// Keep in sync with SPEC_PROFILES in backend/models/chair.py
export const SPEC_PROFILES = [
  { value: 'chair', label: 'Chairs' },
  { value: 'barstool', label: 'Barstools' },
  { value: 'bench', label: 'Benches & Ottomans' },
  { value: 'table_base', label: 'Table Bases' },
  { value: 'table', label: 'Tables' },
  { value: 'booth', label: 'Booths' },
];

const icon = (name) => `/assets/spec-icons/${name}.svg`;

// Drawing per dimension field, per profile. Missing entries fall back to a badge.
const PROFILE_ICONS = {
  chair: {
    height: 'chair-height',
    width: 'chair-width',
    depth: 'chair-depth',
    seat_height: 'chair-seat-height',
    seat_width: 'chair-width',
    seat_depth: 'chair-seat-depth',
    arm_height: 'arm-height',
  },
  barstool: {
    height: 'stool-height',
    width: 'base-width',
    depth: 'chair-depth',
    seat_height: 'stool-seat-height',
    seat_width: 'stool-seat-width',
    seat_depth: 'chair-seat-depth',
    arm_height: 'arm-height',
  },
  bench: {
    height: 'stool-height',
    width: 'stool-seat-width',
    depth: 'chair-depth',
    seat_height: 'stool-seat-height',
    seat_width: 'stool-seat-width',
  },
  table_base: {
    height: 'stool-height',
    width: 'base-width',
    depth: 'base-width',
  },
  table: {},
  booth: {
    height: 'booth-height',
    width: 'booth-width',
    depth: 'booth-depth',
    seat_height: 'booth-seat-height',
  },
};

const DIMENSIONS = [
  { key: 'height', label: 'Height', badge: 'H' },
  { key: 'width', label: 'Width', badge: 'W' },
  { key: 'depth', label: 'Depth', badge: 'D' },
  { key: 'seat_height', label: 'Seat Height', badge: 'SH' },
  { key: 'seat_width', label: 'Seat Width', badge: 'SW' },
  { key: 'seat_depth', label: 'Seat Depth', badge: 'SD' },
  { key: 'arm_height', label: 'Arm Height', badge: 'AH' },
  { key: 'back_height', label: 'Back Height', badge: 'BH' },
];

const formatNumber = (n) => String(Number(Number(n).toFixed(1)));

/** Variation value when set, else the product's. */
const pick = (product, variation, key) =>
  variation?.[key] != null ? variation[key] : product?.[key];

/**
 * Resolve a product's spec profile: its subcategory's, else its category's,
 * else (for a nested category) the parent category's.
 *
 * @param {object} product - needs category_id / subcategory_id
 * @param {Array} categories - tree from productService.getCategories()
 * @returns {string|null}
 */
export const resolveSpecProfile = (product, categories) => {
  if (!product || !Array.isArray(categories)) return null;

  if (product.subcategory_id != null) {
    for (const parent of categories) {
      const sub = getChildren(parent).find(
        (child) => !isNestedCategoryChild(child) && String(child.id) === String(product.subcategory_id)
      );
      if (sub?.spec_profile) return sub.spec_profile;
      if (sub) break;
    }
  }

  if (product.category_id != null) {
    const top = findCategoryById(categories, product.category_id);
    if (top) return top.spec_profile || null;
    const nested = findNestedCategoryById(categories, product.category_id);
    if (nested) return nested.category.spec_profile || nested.parent.spec_profile || null;
  }
  return null;
};

/**
 * Spec rows to show for a product, in catalog order, skipping empty values.
 *
 * @returns {Array<{key: string, label: string, value: string, icon: string|null, badge: string|null}>}
 */
export const getSpecItems = (product, variation, profile) => {
  const icons = PROFILE_ICONS[profile] || {};
  const isArmChair = profile === 'chair' && pick(product, variation, 'arm_height') != null;
  const items = [];

  for (const dim of DIMENSIONS) {
    const value = pick(product, variation, dim.key);
    if (value == null) continue;
    // An arm chair's seat width is measured between the arms
    const name = isArmChair && dim.key === 'seat_width' ? 'between-arms-width' : icons[dim.key];
    items.push({
      key: dim.key,
      label: dim.label,
      value: `${formatNumber(value)}"`,
      icon: name ? icon(name) : null,
      badge: name ? null : dim.badge,
    });
  }

  const shippingWeight = pick(product, variation, 'shipping_weight');
  const weight = shippingWeight ?? pick(product, variation, 'weight');
  if (weight != null) {
    items.push({
      key: 'weight',
      label: shippingWeight != null ? 'Shipping Weight' : 'Weight',
      value: `${formatNumber(weight)} lbs`,
      icon: icon('weight'),
      badge: null,
    });
  }

  const yards = pick(product, variation, 'upholstery_amount');
  if (yards != null && yards > 0) {
    items.push({
      key: 'upholstery_amount',
      label: 'Upholstery',
      value: `${formatNumber(yards)} yd`,
      icon: icon('yardage'),
      badge: null,
    });
  }

  return items;
};

/** Catalog symbol for a feature bullet (stackable, recyclable), or null. */
export const getFeatureSymbol = (feature) => {
  if (typeof feature !== 'string') return null;
  if (/stack/i.test(feature)) return icon('stackable');
  if (/recycl/i.test(feature)) return icon('recyclable');
  return null;
};
