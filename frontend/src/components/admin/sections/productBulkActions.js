import { booleanAction, idAction } from '../bulk/bulkActions';

// Same list ProductEditor offers
export const STOCK_STATUS_OPTIONS = ['Made to Order', 'Available', 'Low Stock', 'Out of Stock', 'Discontinued'];

const stockAction = {
  label: 'Stock status',
  options: STOCK_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
  toChanges: (v) => ({ stock_status: v }),
};

const shownAction = (label, field) => booleanAction(label, field, 'Shown', 'Hidden');

/** Product bulk actions (POST /admin/bulk/products) for the catalog and register */
export function productBulkActions({ categories = [], subcategories = [], families = [] }) {
  const categoryName = (id) => categories.find((c) => c.id === id)?.name;
  return [
    idAction('Move to category', 'category_id', categories),
    idAction('Also list under', 'add_category_id', categories),
    idAction('Remove from category', 'remove_category_id', categories),
    {
      label: 'Set subcategory',
      options: [
        { value: 'none', label: 'No subcategory' },
        ...subcategories.map((sc) => ({
          value: String(sc.id),
          label: categoryName(sc.category_id) ? `${categoryName(sc.category_id)} › ${sc.name}` : sc.name,
        })),
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
    idAction('Add to family', 'add_family_id', families),
    idAction('Remove from family', 'remove_family_id', families),
    idAction('Set main family', 'family_id', families, { none: 'No family' }),
    booleanAction('Featured', 'is_featured', 'Featured', 'Not featured'),
    booleanAction('New', 'is_new', 'Mark new', 'Not new'),
    shownAction('Upholstery', 'upholstery_enabled'),
    shownAction('Colors', 'colors_enabled'),
    shownAction('Laminates', 'laminates_enabled'),
    stockAction,
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
