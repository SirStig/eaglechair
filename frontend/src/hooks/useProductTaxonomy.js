import { useEffect, useMemo, useState } from 'react';
import apiClient from '../config/apiClient';

/**
 * Categories (top-level and nested) and product subcategories for the admin
 * product filters and bulk pickers, as flat lists labelled "Parent › Child".
 *
 * categories:    [{ id, name, label, parent_id }]  parents first, children after
 * subcategories: [{ id, name, label, category_id }]
 */
export default function useProductTaxonomy() {
  const [tree, setTree] = useState([]);
  const [subcategoryRows, setSubcategoryRows] = useState([]);

  useEffect(() => {
    apiClient.get('/api/v1/admin/categories').then((r) => setTree(Array.isArray(r) ? r : [])).catch(() => {});
    apiClient.get('/api/v1/admin/subcategories').then((r) => setSubcategoryRows(r?.items || [])).catch(() => {});
  }, []);

  return useMemo(() => {
    // /admin/categories returns top-level rows; nested categories ride in
    // `subcategories` tagged type "category" (product subcategories are fetched flat)
    const categories = tree.flatMap((top) => [
      { id: top.id, name: top.name, label: top.name, parent_id: null },
      ...(top.subcategories || [])
        .filter((child) => child.type === 'category')
        .map((child) => ({ id: child.id, name: child.name, label: `${top.name} › ${child.name}`, parent_id: top.id })),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const subcategories = subcategoryRows.map((s) => ({
      id: s.id,
      name: s.name,
      category_id: s.category_id,
      label: byId.has(s.category_id) ? `${byId.get(s.category_id).label} › ${s.name}` : s.name,
    }));
    return { categories, subcategories };
  }, [tree, subcategoryRows]);
}

/** A category's id plus its nested categories' ids (what a category filter matches) */
export const categoryTreeIds = (categories, categoryId) =>
  new Set([categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)]);
