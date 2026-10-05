import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, Search, Check } from 'lucide-react';
import { getChildren, findCategoryById, findNestedCategoryById } from '../../utils/categoryTree';

const sameId = (a, b) => String(a) === String(b);

const inputClass =
  'w-full px-3 py-2 text-sm border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all';

// Collapsible block. Sections with an active filter start open so a visitor
// can always see (and undo) what is applied.
const Section = ({ title, count = 0, open, onToggle, children }) => (
  <div className="border-b border-cream-200 last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between py-3.5 text-sm font-semibold text-slate-800 hover:text-primary-600 transition-colors"
    >
      <span className="flex items-center gap-2">
        {title}
        {count > 0 && (
          <span className="text-[11px] leading-none bg-primary-600 text-white px-1.5 py-1 rounded-full font-semibold min-w-[20px] text-center">
            {count}
          </span>
        )}
      </span>
      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="pb-4">{children}</div>}
  </div>
);

const CheckRow = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2.5 py-1.5 cursor-pointer text-sm text-slate-700 hover:text-slate-900">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
    />
    <span className="flex-1 truncate">{label}</span>
  </label>
);

const RangeInputs = ({ label, minValue, maxValue, onMin, onMax }) => (
  <div>
    <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
    <div className="flex items-center gap-2">
      <input type="number" inputMode="decimal" placeholder="Min" aria-label={`${label} minimum`} value={minValue} onChange={(e) => onMin(e.target.value)} className={inputClass} />
      <span className="text-slate-400 text-sm">–</span>
      <input type="number" inputMode="decimal" placeholder="Max" aria-label={`${label} maximum`} value={maxValue} onChange={(e) => onMax(e.target.value)} className={inputClass} />
    </div>
  </div>
);

const CheckList = ({ items, selected, onToggle, limit = 8 }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, limit);
  return (
    <div>
      {visible.map((item) => (
        <CheckRow
          key={item.id}
          label={item.name}
          checked={selected.includes(String(item.id))}
          onChange={() => onToggle(String(item.id))}
        />
      ))}
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
};

// One tree for categories and their children: picking a category opens its
// subcategories right underneath it.
const CategoryTree = ({ categories, activeParent, activeChild, selectCategory }) => {
  // Explicit open/closed choices; otherwise only the active category is open.
  const [openState, setOpenState] = useState({});
  const isOpen = (cat) => openState[cat.id] ?? sameId(cat.id, activeParent?.id);
  const toggleOpen = (cat) => setOpenState((prev) => ({ ...prev, [cat.id]: !isOpen(cat) }));

  const rowBase =
    'w-full flex items-center justify-between gap-2 text-left text-sm rounded-lg transition-colors';

  return (
    <ul className="space-y-0.5">
      <li>
        <button
          type="button"
          onClick={() => selectCategory(null, null)}
          className={`${rowBase} px-3 py-2 ${!activeParent ? 'bg-primary-600 text-white font-semibold' : 'text-slate-700 hover:bg-cream-100'}`}
        >
          All Products
        </button>
      </li>
      {categories.map((cat) => {
        const isParentActive = sameId(cat.id, activeParent?.id);
        const countsKnown = cat.has_products !== undefined;
        const children = getChildren(cat).filter(
          (child) =>
            !countsKnown ||
            child.product_count > 0 ||
            (isParentActive && activeChild && child.type === activeChild.type && sameId(child.id, activeChild.id))
        );
        if (cat.has_products === false && children.length === 0 && !isParentActive) return null;
        const isSelected = isParentActive && !activeChild;
        const open = children.length > 0 && isOpen(cat);
        return (
          <li key={cat.id}>
            <div
              className={`flex items-center rounded-lg ${isSelected
                ? 'bg-primary-600 text-white'
                : isParentActive
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-slate-700 hover:bg-cream-100'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenState((prev) => ({ ...prev, [cat.id]: true }));
                  if (!isSelected) selectCategory(cat, null);
                }}
                aria-current={isSelected ? 'true' : undefined}
                className={`${rowBase} flex-1 min-w-0 pl-3 pr-1 py-2 ${isParentActive ? 'font-semibold' : ''}`}
              >
                <span className="truncate">{cat.name}</span>
                {cat.product_count > 0 && (
                  <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {cat.product_count}
                  </span>
                )}
              </button>
              {children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleOpen(cat)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Hide' : 'Show'} ${cat.name} subcategories`}
                  className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg ${isSelected ? 'hover:bg-white/15' : 'hover:bg-cream-200'}`}
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>
              ) : (
                <span className="w-9 flex-shrink-0" />
              )}
            </div>

            {open && (
              <ul className="ml-4 mt-0.5 mb-1.5 pl-2 border-l-2 border-cream-200 space-y-0.5">
                {children.map((child) => {
                  const active =
                    isParentActive &&
                    !!activeChild &&
                    child.type === activeChild.type &&
                    sameId(child.id, activeChild.id);
                  return (
                    <li key={`${child.type || 'subcategory'}-${child.id}`}>
                      <button
                        type="button"
                        // Clicking the active child again steps back to its parent
                        onClick={() => selectCategory(cat, active ? null : child)}
                        aria-current={active ? 'true' : undefined}
                        className={`${rowBase} px-3 py-1.5 ${active
                          ? 'bg-primary-600 text-white font-semibold'
                          : 'text-slate-600 hover:bg-cream-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {active && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="truncate">{child.name}</span>
                        </span>
                        {child.product_count > 0 && (
                          <span className={`text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>
                            {child.product_count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const FilterSidebar = ({
  filters,
  updateFilter,
  updateFilters,
  selectCategory,
  clearFilters,
  hasActiveFilters,
  toggleArrayFilter,
  categories,
  families,
  upholsteries,
  colors,
  showUpholsteryFilter,
  showStackableFilter,
  showOutdoorFilter,
  showMobileFilters,
  onCloseMobile,
  resultCount,
  loading,
}) => {
  const [openSections, setOpenSections] = useState({});
  const cardRef = useRef(null);

  // Desktop: until the panel sticks it sits lower than its sticky offset, so
  // a fixed viewport-based max-height pushes its bottom off screen. Fit it to
  // the space actually left below its current top instead.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof window === 'undefined') return undefined;
    const desktop = window.matchMedia('(min-width: 1024px)');
    let frame = 0;
    const fit = () => {
      frame = 0;
      if (!desktop.matches) {
        card.style.maxHeight = '';
        return;
      }
      const top = Math.max(card.getBoundingClientRect().top, 96);
      card.style.maxHeight = `${Math.max(window.innerHeight - top - 16, 240)}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    desktop.addEventListener('change', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      desktop.removeEventListener('change', schedule);
      card.style.maxHeight = '';
    };
  }, []);

  const isOpen = (key, active) => openSections[key] ?? active;
  const toggle = (key, active) =>
    setOpenSections((prev) => ({ ...prev, [key]: !isOpen(key, active) }));

  // Families with no products are hidden unless one is the current filter
  const visibleFamilies = families.filter(
    (family) => family.product_count > 0 || sameId(filters.family_id, family.id)
  );

  // Resolve the selected category / child from the tree
  const nested = findNestedCategoryById(categories, filters.category_id);
  const activeParent = nested ? nested.parent : findCategoryById(categories, filters.category_id);
  const activeChild = nested
    ? nested.category
    : getChildren(activeParent).find(
      (c) => c.type !== 'category' && sameId(c.id, filters.subcategory_id)
    );

  const nameOf = (list, id) => list.find((item) => sameId(item.id, id))?.name || id;
  const range = (min, max) =>
    min && max ? `${min}–${max}″` : min ? `≥ ${min}″` : `≤ ${max}″`;

  // Removable chips for everything currently applied
  const chips = [];
  if (activeParent) chips.push({ key: 'cat', label: activeParent.name, onRemove: () => selectCategory(null, null) });
  if (activeChild) chips.push({ key: 'child', label: activeChild.name, onRemove: () => selectCategory(activeParent, null) });
  if (filters.search) chips.push({ key: 'search', label: `“${filters.search}”`, onRemove: () => updateFilter('search', '') });
  if (filters.family_id) chips.push({ key: 'family', label: nameOf(families, filters.family_id), onRemove: () => updateFilter('family_id', '') });
  filters.upholstery_ids.forEach((id) => chips.push({ key: `uph-${id}`, label: nameOf(upholsteries, id), onRemove: () => toggleArrayFilter('upholstery_ids', id) }));
  filters.color_ids.forEach((id) => chips.push({ key: `col-${id}`, label: nameOf(colors, id), onRemove: () => toggleArrayFilter('color_ids', id) }));
  if (filters.is_stackable) chips.push({ key: 'stack', label: 'Stackable', onRemove: () => updateFilter('is_stackable', null) });
  if (filters.is_outdoor_suitable) chips.push({ key: 'outdoor', label: 'Outdoor', onRemove: () => updateFilter('is_outdoor_suitable', null) });
  if (filters.ada_compliant) chips.push({ key: 'ada', label: 'ADA compliant', onRemove: () => updateFilter('ada_compliant', null) });
  if (filters.featured) chips.push({ key: 'featured', label: 'Featured', onRemove: () => updateFilter('featured', false) });
  if (filters.new) chips.push({ key: 'new', label: 'New', onRemove: () => updateFilter('new', false) });
  if (filters.min_height || filters.max_height) {
    chips.push({
      key: 'height',
      label: `Height ${range(filters.min_height, filters.max_height)}`,
      onRemove: () => updateFilters({ min_height: '', max_height: '' }),
    });
  }
  if (filters.min_width || filters.max_width) {
    chips.push({
      key: 'width',
      label: `Width ${range(filters.min_width, filters.max_width)}`,
      onRemove: () => updateFilters({ min_width: '', max_width: '' }),
    });
  }
  if (filters.stock_status) chips.push({ key: 'stock', label: filters.stock_status, onRemove: () => updateFilter('stock_status', '') });

  const materialsCount = filters.upholstery_ids.length + filters.color_ids.length;
  const featureCount = [filters.is_stackable, filters.is_outdoor_suitable, filters.ada_compliant, filters.featured, filters.new].filter(Boolean).length;
  const sizeCount = [filters.min_height || filters.max_height, filters.min_width || filters.max_width].filter(Boolean).length;
  const availabilityCount = filters.stock_status ? 1 : 0;
  const showMaterials =
    (showUpholsteryFilter && upholsteries.length > 0) ||
    colors.length > 0;

  // Sticky stops at the bottom of the sidebar column (which spans the product
  // grid), so on desktop the panel follows the scroll and parks above the footer.
  return (
    <div
      className={`
        lg:w-full
        ${showMobileFilters ? 'max-lg:fixed max-lg:inset-4 max-lg:z-50' : 'max-lg:hidden'}
        lg:block lg:sticky lg:top-24 lg:z-0
      `}
    >
    <div
      ref={cardRef}
      className={`
        rounded-xl shadow-lg bg-white border border-cream-200
        flex flex-col w-full h-full overflow-hidden
        ${showMobileFilters ? 'max-lg:max-h-[90dvh]' : ''}
        lg:max-h-[calc(100dvh-7rem)]
      `}
    >
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-cream-200 bg-cream-50 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800">Filters</h2>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors min-h-[32px] px-2"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden text-slate-600 hover:text-slate-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-4 filter-sidebar-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-lg:overscroll-contain [-webkit-overflow-scrolling:touch]">
        {chips.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Applied</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remove ${chip.label}`}
                  className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-xs font-medium text-primary-800 hover:bg-primary-100 transition-colors"
                >
                  <span className="truncate">{chip.label}</span>
                  <X className="w-3 h-3 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2.5 pb-4 border-b border-cream-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Search name or model #"
              aria-label="Search products"
              className={`${inputClass} pl-9 py-2.5`}
            />
          </div>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            aria-label="Sort products"
            className={`${inputClass} py-2.5`}
          >
            <option value="smart">Sort: Recommended</option>
            <option value="featured">Sort: Featured first</option>
            <option value="name-asc">Sort: Name A–Z</option>
            <option value="name-desc">Sort: Name Z–A</option>
          </select>
        </div>

        <div className="py-4 border-b border-cream-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Category</h3>
          <CategoryTree
            categories={categories}
            activeParent={activeParent}
            activeChild={activeChild}
            selectCategory={selectCategory}
          />
        </div>

        {visibleFamilies.length > 0 && (
          <Section
            title="Product Family"
            count={filters.family_id ? 1 : 0}
            open={isOpen('family', !!filters.family_id)}
            onToggle={() => toggle('family', !!filters.family_id)}
          >
            <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
              {visibleFamilies.map((family) => {
                const active = sameId(filters.family_id, family.id);
                return (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => updateFilter('family_id', active ? '' : family.id)}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${active
                      ? 'bg-primary-600 text-white font-semibold'
                      : 'text-slate-700 hover:bg-cream-100'
                    }`}
                  >
                    <span className="truncate">{family.name}</span>
                    {family.product_count > 0 && (
                      <span className={`text-xs flex-shrink-0 ${active ? 'text-white/80' : 'text-slate-400'}`}>
                        {family.product_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section
          title="Features"
          count={featureCount}
          open={isOpen('features', featureCount > 0)}
          onToggle={() => toggle('features', featureCount > 0)}
        >
          {showStackableFilter && (
            <CheckRow label="Stackable" checked={filters.is_stackable === true} onChange={(e) => updateFilter('is_stackable', e.target.checked ? true : null)} />
          )}
          {showOutdoorFilter && (
            <CheckRow label="Outdoor suitable" checked={filters.is_outdoor_suitable === true} onChange={(e) => updateFilter('is_outdoor_suitable', e.target.checked ? true : null)} />
          )}
          <CheckRow label="ADA compliant" checked={filters.ada_compliant === true} onChange={(e) => updateFilter('ada_compliant', e.target.checked ? true : null)} />
          <CheckRow label="Featured" checked={!!filters.featured} onChange={(e) => updateFilter('featured', e.target.checked)} />
          <CheckRow label="New products" checked={!!filters.new} onChange={(e) => updateFilter('new', e.target.checked)} />
        </Section>

        {showMaterials && (
          <Section
            title="Materials"
            count={materialsCount}
            open={isOpen('materials', materialsCount > 0)}
            onToggle={() => toggle('materials', materialsCount > 0)}
          >
            <div className="space-y-4">
              {showUpholsteryFilter && upholsteries.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Upholstery</span>
                  <CheckList items={upholsteries} selected={filters.upholstery_ids} onToggle={(id) => toggleArrayFilter('upholstery_ids', id)} />
                </div>
              )}
              {colors.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Color</span>
                  <div className="grid grid-cols-6 gap-2">
                    {colors.map((color) => {
                      const active = filters.color_ids.includes(String(color.id));
                      return (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => toggleArrayFilter('color_ids', String(color.id))}
                          aria-pressed={active}
                          aria-label={color.name}
                          title={color.name}
                          className={`aspect-square rounded-full border-2 transition-all ${active
                            ? 'border-primary-600 ring-2 ring-primary-200 ring-offset-1'
                            : 'border-cream-300 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: color.hex_value || '#ccc' }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        <Section
          title="Size"
          count={sizeCount}
          open={isOpen('size', sizeCount > 0)}
          onToggle={() => toggle('size', sizeCount > 0)}
        >
          <div className="space-y-3">
            <RangeInputs
              label="Overall height (in)"
              minValue={filters.min_height}
              maxValue={filters.max_height}
              onMin={(v) => updateFilter('min_height', v)}
              onMax={(v) => updateFilter('max_height', v)}
            />
            <RangeInputs
              label="Overall width (in)"
              minValue={filters.min_width}
              maxValue={filters.max_width}
              onMin={(v) => updateFilter('min_width', v)}
              onMax={(v) => updateFilter('max_width', v)}
            />
          </div>
        </Section>

        <Section
          title="Availability"
          count={availabilityCount}
          open={isOpen('availability', availabilityCount > 0)}
          onToggle={() => toggle('availability', availabilityCount > 0)}
        >
          <div className="space-y-3">
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">Stock status</span>
              <select
                value={filters.stock_status}
                onChange={(e) => updateFilter('stock_status', e.target.value)}
                aria-label="Stock status"
                className={inputClass}
              >
                <option value="">Any</option>
                <option value="In Stock">In Stock</option>
                <option value="Made to Order">Made to Order</option>
                <option value="Custom Only">Custom Only</option>
              </select>
            </div>
          </div>
        </Section>
      </div>

      <div className="lg:hidden flex-shrink-0 p-3 border-t border-cream-200 bg-white">
        <button
          type="button"
          onClick={onCloseMobile}
          className="w-full min-h-[44px] rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
        >
          {loading ? 'Updating…' : `Show ${resultCount} product${resultCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
    </div>
  );
};

export default FilterSidebar;
