import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../config/apiClient';
import { withPrimary } from './categoryAssignment';

const SELECT =
  'w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all';


const CheckList = ({ items, primaryId, selected, onToggle, empty, label }) => (
  <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 p-3 bg-dark-700 border border-dark-600 rounded-lg">
    {items.length === 0 && <span className="text-sm text-dark-400">{empty}</span>}
    {items.map((item) => {
      const isPrimary = item.id === primaryId;
      return (
        <label
          key={item.id}
          className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
            isPrimary ? 'text-dark-300' : 'text-dark-100 hover:bg-dark-600 cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={isPrimary || selected.includes(item.id)}
            disabled={isPrimary}
            onChange={() => onToggle(item.id)}
            className="rounded border-dark-500 bg-dark-800 text-primary-500 focus:ring-primary-500"
          />
          <span>{label(item)}</span>
          {isPrimary && <span className="text-xs text-primary-400">primary</span>}
        </label>
      );
    })}
  </div>
);

/**
 * Primary category / subcategory plus any number of extra ones, for records
 * listed under several categories (product families).
 *
 * value: { category_id, subcategory_id, category_ids, subcategory_ids }
 * onChange(patch) merges into the parent form state.
 */
const CategoryAssignmentFields = ({ value, onChange, noun = 'family' }) => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const categoryIds = withPrimary(value.category_id, value.category_ids);
  const subcategoryIds = withPrimary(value.subcategory_id, value.subcategory_ids);
  const categoryKey = categoryIds.join(',');

  useEffect(() => {
    apiClient
      .get('/api/v1/categories?include_nested=true')
      .then((list) => {
        const all = Array.isArray(list) ? list : [];
        // Parents first, each followed by its nested categories
        setCategories(all.filter((c) => !c.parent_id).flatMap((p) => [p, ...all.filter((c) => c.parent_id === p.id)]));
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!categoryKey) {
      setSubcategories([]);
      return;
    }
    let cancelled = false;
    Promise.all(categoryKey.split(',').map((id) => apiClient.get(`/api/v1/admin/subcategories?category_id=${id}`)))
      .then((responses) => {
        if (cancelled) return;
        const seen = new Set();
        setSubcategories(responses.flatMap((r) => r.items || []).filter((s) => !seen.has(s.id) && seen.add(s.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryKey]);

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return (c) => (c.parent_id && byId.get(c.parent_id) ? `${byId.get(c.parent_id).name} › ${c.name}` : c.name);
  }, [categories]);

  const toggle = (key, primaryKey, id) => {
    if (id === value[primaryKey]) return;
    const current = (value[key] || []).filter((x) => x !== value[primaryKey]);
    onChange({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  const setPrimary = (primaryKey, key, id) => {
    // The old primary stays in the set as an extra one
    onChange({ [primaryKey]: id, [key]: withPrimary(id, withPrimary(value[primaryKey], value[key])) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">Primary category</label>
          <select
            value={value.category_id || ''}
            onChange={(e) => setPrimary('category_id', 'category_ids', e.target.value ? parseInt(e.target.value, 10) : null)}
            className={SELECT}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryName(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">Primary subcategory</label>
          <select
            value={value.subcategory_id || ''}
            onChange={(e) => setPrimary('subcategory_id', 'subcategory_ids', e.target.value ? parseInt(e.target.value, 10) : null)}
            className={SELECT}
            disabled={subcategories.length === 0 && !value.subcategory_id}
          >
            <option value="">None</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-dark-200 mb-1">Also list under these categories</span>
        <p className="mb-2 text-xs text-dark-400">
          The {noun} shows up in every checked category. The primary category is always included.
        </p>
        <CheckList
          items={categories}
          primaryId={value.category_id}
          selected={categoryIds}
          onToggle={(id) => toggle('category_ids', 'category_id', id)}
          empty="Loading categories…"
          label={categoryName}
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-dark-200 mb-1">Also list under these subcategories</span>
        <p className="mb-2 text-xs text-dark-400">Subcategories of the checked categories.</p>
        <CheckList
          items={subcategories}
          primaryId={value.subcategory_id}
          selected={subcategoryIds}
          onToggle={(id) => toggle('subcategory_ids', 'subcategory_id', id)}
          empty="No subcategories for the checked categories"
          label={(s) => s.name}
        />
      </div>
    </div>
  );
};

export default CategoryAssignmentFields;
