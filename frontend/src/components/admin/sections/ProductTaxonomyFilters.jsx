import { categoryTreeIds } from '../../../hooks/useProductTaxonomy';

/**
 * Category / subcategory / family selects shared by the Product Catalog and
 * Product Register. Values are strings: '' = all, 'none' = has none, else an id.
 * Picking a category narrows the subcategory list to it (and its nested
 * categories) and drops a subcategory that no longer fits.
 */
export default function ProductTaxonomyFilters({
  taxonomy,
  families = [],
  category,
  subcategory,
  family,
  onChange,
  selectClassName,
  labelled = false,
}) {
  const { categories, subcategories } = taxonomy;
  const tree = category ? categoryTreeIds(categories, Number(category)) : null;
  const subcategoryOptions = tree ? subcategories.filter((s) => tree.has(s.category_id)) : subcategories;

  const changeCategory = (value) => {
    const next = { category: value };
    if (value && subcategory && subcategory !== 'none') {
      const keep = categoryTreeIds(categories, Number(value));
      const sc = subcategories.find((s) => String(s.id) === subcategory);
      if (!sc || !keep.has(sc.category_id)) next.subcategory = '';
    }
    onChange(next);
  };

  const field = (label, control) =>
    labelled ? (
      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">{label}</label>
        {control}
      </div>
    ) : (
      control
    );

  return (
    <>
      {field(
        'Category',
        <select className={selectClassName} value={category} onChange={(e) => changeCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.label}</option>
          ))}
        </select>
      )}
      {field(
        'Subcategory',
        <select className={selectClassName} value={subcategory} onChange={(e) => onChange({ subcategory: e.target.value })} aria-label="Subcategory">
          <option value="">All subcategories</option>
          <option value="none">No subcategory</option>
          {subcategoryOptions.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.label}</option>
          ))}
        </select>
      )}
      {field(
        'Family',
        <select className={selectClassName} value={family} onChange={(e) => onChange({ family: e.target.value })} aria-label="Family">
          <option value="">All families</option>
          <option value="none">No family</option>
          {families.map((f) => (
            <option key={f.id} value={String(f.id)}>{f.name}</option>
          ))}
        </select>
      )}
    </>
  );
}
