import { booleanAction, idAction } from '../bulk/bulkActions';
import { supplierLinkOptions } from './supplierLinkTypes';

// Same list ProductEditor offers
export const STOCK_STATUS_OPTIONS = ['Made to Order', 'Available', 'Low Stock', 'Out of Stock', 'Discontinued'];

const stockAction = {
  label: 'Stock status',
  options: STOCK_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
  toChanges: (v) => ({ stock_status: v }),
};

const shownAction = (label, field) => booleanAction(label, field, 'Shown', 'Hidden');

const withCode = (name, code) => (code ? `${name} (${code})` : name);
const inactive = (row, label) => (row.is_active === false ? `${label} (inactive)` : label);

// Option lists a product can offer: [group (also the add_/remove_ op suffix), row label]
const MATERIAL_GROUPS = [
  ['finishes', (f) => withCode(f.name, f.finish_code)],
  ['upholsteries', (u) => withCode(u.name, u.material_code)],
  ['colors', (c) => c.name],
  ['laminates', (l) => withCode([l.brand, l.pattern_name].filter(Boolean).join(' '), l.pattern_code)],
];

/** One-click change that empties something; asks first */
const clearAction = (label, changes) => ({ label, changes, confirm: true, tone: 'danger' });

/** Add / Remove pickers (several at once) and Clear for each material list on a product */
const materialActions = (materials) =>
  MATERIAL_GROUPS.flatMap(([group, label]) => {
    const rows = materials[group] || [];
    const options = (list) => list.map((r) => ({ value: r.id, label: inactive(r, label(r)) }));
    return [
      {
        label: `Add ${group}`,
        multiple: true,
        // Only offer active ones to add; removing can still clear out retired ones
        options: options(rows.filter((r) => r.is_active !== false)),
        toChanges: (ids) => ({ [`add_${group}`]: ids }),
      },
      {
        label: `Remove ${group}`,
        multiple: true,
        options: options(rows),
        toChanges: (ids) => ({ [`remove_${group}`]: ids }),
      },
      clearAction(`Clear ${group}`, { [`clear_${group}`]: true }),
    ];
  });

/**
 * Product bulk actions (POST /admin/bulk/products) for the catalog and register.
 * `categories` / `subcategories` come from hooks/useProductTaxonomy (labelled
 * "Parent › Child"). `materials` ({ finishes, upholsteries, colors, laminates },
 * see hooks/useMaterialLists) adds the add/remove/clear material pickers.
 */
export function productBulkActions({
  categories = [],
  subcategories = [],
  families = [],
  supplierLinks = [],
  materials = {},
}) {
  const getLabel = (r) => r.label || r.name;
  return [
    idAction('Move to category', 'category_id', categories, { getLabel }),
    idAction('Also list under', 'add_category_id', categories, { getLabel }),
    idAction('Remove from category', 'remove_category_id', categories, { getLabel }),
    clearAction('Clear extra categories', { clear_categories: true }),
    {
      label: 'Set subcategory',
      options: [
        { value: 'none', label: 'No subcategory' },
        ...subcategories.map((sc) => ({ value: String(sc.id), label: getLabel(sc) })),
      ],
      // A subcategory also moves the product to its parent category
      toChanges: (v) => {
        if (v === 'none') return { subcategory_id: null };
        const sc = subcategories.find((s) => s.id === Number(v));
        return sc?.category_id
          ? { category_id: sc.category_id, subcategory_id: sc.id }
          : { subcategory_id: Number(v) };
      },
    },
    idAction('Add subcategory', 'add_subcategory_id', subcategories, { getLabel }),
    idAction('Remove subcategory', 'remove_subcategory_id', subcategories, { getLabel }),
    clearAction('Clear subcategories', { subcategory_id: null }),
    idAction('Add to family', 'add_family_id', families),
    idAction('Remove from family', 'remove_family_id', families),
    idAction('Set main family', 'family_id', families, { none: 'No family' }),
    clearAction('Clear families', { clear_families: true }),
    booleanAction('Featured', 'is_featured', 'Featured', 'Not featured'),
    booleanAction('New', 'is_new', 'Mark new', 'Not new'),
    shownAction('Upholstery', 'upholstery_enabled'),
    shownAction('Colors', 'colors_enabled'),
    shownAction('Laminates', 'laminates_enabled'),
    stockAction,
    ...materialActions(materials),
    // Outside catalogs the product can be ordered with (Supplier Links)
    {
      label: 'Add supplier link',
      options: supplierLinkOptions(supplierLinks),
      toChanges: (v) => ({ add_material_sources: [Number(v)] }),
    },
    {
      label: 'Remove supplier link',
      options: supplierLinkOptions(supplierLinks),
      toChanges: (v) => ({ remove_material_sources: [Number(v)] }),
    },
    clearAction('Clear supplier links', { clear_material_sources: true }),
  ];
}

const overrideAction = (label, field) => ({
  label,
  options: [
    { value: 'inherit', label: 'Same as product' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ],
  toChanges: (v) => ({ [field]: v === 'inherit' ? null : v === 'on' }),
});

/** Variation bulk actions (POST /admin/bulk/variations) */
export function variationBulkActions({ families = [] }) {
  return [
    booleanAction('Available', 'is_available', 'Available', 'Unavailable'),
    stockAction,
    overrideAction('Upholstery', 'upholstery_enabled'),
    overrideAction('Colors', 'colors_enabled'),
    overrideAction('Laminates', 'laminates_enabled'),
    idAction('Add to family', 'add_family_id', families),
    idAction('Remove from family', 'remove_family_id', families),
  ];
}
