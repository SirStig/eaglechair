/**
 * Category tree helpers.
 *
 * The API returns primary (top-level) categories only, each with a
 * `subcategories` array holding its children. A child is either a row from the
 * product_subcategories table (`type: 'subcategory'`) or a nested category —
 * a category with a parent (`type: 'category'`). Both render as children of
 * their parent; neither is ever a primary category.
 */

export const CHILD_TYPE_CATEGORY = 'category';
export const CHILD_TYPE_SUBCATEGORY = 'subcategory';

const sameId = (a, b) => String(a) === String(b);

export const getChildren = (category) =>
  Array.isArray(category?.subcategories) ? category.subcategories : [];

export const isNestedCategoryChild = (child) => child?.type === CHILD_TYPE_CATEGORY;

export const findCategoryBySlug = (categories, slug) =>
  (categories || []).find((c) => c.slug === slug);

export const findCategoryById = (categories, id) =>
  (categories || []).find((c) => sameId(c.id, id));

export const findChildBySlug = (category, slug) => {
  if (!slug) return undefined;
  const target = String(slug).toLowerCase();
  return getChildren(category).find((child) => (child.slug || '').toLowerCase() === target);
};

/**
 * Find a nested category by ID anywhere in the tree.
 * @returns {{category: object, parent: object}|null}
 */
export const findNestedCategoryById = (categories, id) => {
  if (id === '' || id === null || id === undefined) return null;
  for (const parent of categories || []) {
    const match = getChildren(parent).find(
      (child) => isNestedCategoryChild(child) && sameId(child.id, id)
    );
    if (match) return { category: match, parent };
  }
  return null;
};

/**
 * Find a nested category by slug anywhere in the tree.
 * @returns {{category: object, parent: object}|null}
 */
export const findNestedCategoryBySlug = (categories, slug) => {
  if (!slug) return null;
  const target = String(slug).toLowerCase();
  for (const parent of categories || []) {
    const match = getChildren(parent).find(
      (child) =>
        isNestedCategoryChild(child) && (child.slug || '').toLowerCase() === target
    );
    if (match) return { category: match, parent };
  }
  return null;
};

/**
 * The filter key a child maps to: nested categories filter by category,
 * subcategories filter by subcategory.
 */
export const childFilterKey = (child) =>
  isNestedCategoryChild(child) ? 'category_id' : 'subcategory_id';

export const isChildActive = (child, filters) =>
  sameId(filters?.[childFilterKey(child)] ?? '', child.id);
