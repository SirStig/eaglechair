import { Filter, X, ChevronDown, ChevronUp, ArrowUpDown, Search, Folder, Grid3x3, Users } from 'lucide-react';

const FilterSidebar = ({
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  expandedSections,
  toggleFilterSection,
  toggleArrayFilter,
  categories,
  subcategories,
  families,
  finishes,
  upholsteries,
  colors,
  debouncedSearch,
  showFinishFilter,
  showUpholsteryFilter,
  showStackableFilter,
  showOutdoorFilter,
  showMobileFilters,
  onCloseMobile,
}) => {
  const scrollBodyStyle = {
    height: 'calc(100vh - 200px)',
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'scroll',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <div
      className={`
        rounded-xl shadow-lg bg-white border border-cream-200
        flex flex-col
        ${showMobileFilters ? 'fixed inset-4 z-50 max-h-[90vh] lg:max-h-none' : 'hidden lg:block'}
        lg:fixed lg:top-24 lg:left-8 xl:left-12 2xl:left-16
        lg:w-[320px] xl:w-[360px]
        lg:h-[calc(100vh-6rem)]
      `}
    >
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-cream-200 bg-cream-50 flex-shrink-0">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">Filters</h2>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 transition-colors min-h-[32px] px-2"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Clear All</span>
              <span className="sm:hidden">Clear</span>
            </button>
          )}
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-600 hover:text-slate-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 filter-sidebar-scroll" style={scrollBodyStyle}>
        <div className="pb-4 border-b border-cream-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2.5">
            <ArrowUpDown className="w-4 h-4" />
            Sort Products
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="w-full px-3 py-2.5 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium transition-all"
          >
            <option value="smart">Smart Sort (Recommended)</option>
            <option value="featured">Featured First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
            <Search className="w-4 h-4" />
            Search Products
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search by name, model..."
            className="w-full px-3 py-2.5 border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all"
          />
          {debouncedSearch && (
            <p className="mt-1.5 text-xs text-slate-500">
              Searching for &quot;{debouncedSearch}&quot;...
            </p>
          )}
        </div>

        <div className="pb-4 border-b border-cream-200">
          <button
            onClick={() => toggleFilterSection('category')}
            className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-primary-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" />
              Category
              {filters.category_id && (
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                  1
                </span>
              )}
            </span>
            {expandedSections.category ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSections.category && (
            <div className="space-y-1.5">
              <button
                onClick={() => updateFilter('category_id', '')}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${!filters.category_id
                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                  : 'hover:bg-cream-100 text-slate-700'
                }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => updateFilter('category_id', category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${filters.category_id === category.id || filters.category_id === String(category.id)
                    ? 'bg-primary-600 text-white font-semibold shadow-sm'
                    : 'hover:bg-cream-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{category.name}</span>
                    {category.product_count > 0 && (
                      <span className={`text-xs ${filters.category_id === category.id || filters.category_id === String(category.id) ? 'text-white/80' : 'text-slate-500'}`}>
                        {category.product_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {subcategories.length > 0 && (
          <div className="pb-4 border-b border-cream-200">
            <button
              onClick={() => toggleFilterSection('subcategory')}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-primary-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Subcategory
                {filters.subcategory_id && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    1
                  </span>
                )}
              </span>
              {expandedSections.subcategory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSections.subcategory && (
              <div className="space-y-1.5">
                {subcategories.map((subcat) => (
                  <button
                    key={subcat.id}
                    onClick={() => updateFilter('subcategory_id', subcat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${filters.subcategory_id === subcat.id || filters.subcategory_id === String(subcat.id)
                      ? 'bg-primary-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-cream-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{subcat.name}</span>
                      {subcat.product_count > 0 && (
                        <span className={`text-xs ${filters.subcategory_id === subcat.id || filters.subcategory_id === String(subcat.id) ? 'text-white/80' : 'text-slate-500'}`}>
                          {subcat.product_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {families.length > 0 && (
          <div className="pb-4 border-b border-cream-200">
            <button
              onClick={() => toggleFilterSection('family')}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-primary-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Product Family
                {filters.family_id && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    1
                  </span>
                )}
              </span>
              {expandedSections.family ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expandedSections.family && (
              <div className="space-y-1.5">
                <button
                  onClick={() => updateFilter('family_id', '')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${!filters.family_id
                    ? 'bg-primary-600 text-white font-semibold shadow-sm'
                    : 'hover:bg-cream-100 text-slate-700'
                  }`}
                >
                  All Families
                </button>
                {families.map((family) => (
                  <button
                    key={family.id}
                    onClick={() => updateFilter('family_id', family.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${filters.family_id === family.id || filters.family_id === String(family.id)
                      ? 'bg-primary-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-cream-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate pr-2">{family.name}</span>
                      {family.product_count > 0 && (
                        <span className={`text-xs flex-shrink-0 ${filters.family_id === family.id || filters.family_id === String(family.id) ? 'text-white/80' : 'text-slate-500'}`}>
                          {family.product_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <button
            onClick={() => toggleFilterSection('filters')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-700 mb-2"
          >
            <span>Materials & Finishes</span>
            {expandedSections.filters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSections.filters && (
            <div className="space-y-3">
              {showFinishFilter && finishes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Finishes</label>
                  <div className="space-y-1">
                    {finishes.slice(0, 10).map((finish) => (
                      <label key={finish.id} className="flex items-center cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={filters.finish_ids.includes(String(finish.id))}
                          onChange={() => toggleArrayFilter('finish_ids', String(finish.id))}
                          className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-slate-700">{finish.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {showUpholsteryFilter && upholsteries.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Upholstery</label>
                  <div className="space-y-1">
                    {upholsteries.slice(0, 10).map((upholstery) => (
                      <label key={upholstery.id} className="flex items-center cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={filters.upholstery_ids.includes(String(upholstery.id))}
                          onChange={() => toggleArrayFilter('upholstery_ids', String(upholstery.id))}
                          className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-slate-700">{upholstery.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {colors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Colors</label>
                  <div className="grid grid-cols-4 gap-2">
                    {colors.slice(0, 12).map((color) => (
                      <button
                        key={color.id}
                        onClick={() => toggleArrayFilter('color_ids', String(color.id))}
                        className={`w-full aspect-square rounded-lg border-2 transition-all ${filters.color_ids.includes(String(color.id))
                          ? 'border-primary-600 ring-2 ring-primary-200'
                          : 'border-cream-300 hover:border-cream-400'
                        }`}
                        style={{ backgroundColor: color.hex_value || '#ccc' }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => toggleFilterSection('features')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-700 mb-2"
          >
            <span>Features</span>
            {expandedSections.features ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSections.features && (
            <div className="space-y-2">
              {showStackableFilter && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.is_stackable === true}
                    onChange={(e) => updateFilter('is_stackable', e.target.checked ? true : null)}
                    className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Stackable</span>
                </label>
              )}

              {showOutdoorFilter && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.is_outdoor_suitable === true}
                    onChange={(e) => updateFilter('is_outdoor_suitable', e.target.checked ? true : null)}
                    className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Outdoor Suitable</span>
                </label>
              )}

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.ada_compliant === true}
                  onChange={(e) => updateFilter('ada_compliant', e.target.checked ? true : null)}
                  className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">ADA Compliant</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.featured}
                  onChange={(e) => updateFilter('featured', e.target.checked)}
                  className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Featured Only</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.new}
                  onChange={(e) => updateFilter('new', e.target.checked)}
                  className="mr-2 h-4 w-4 text-primary-600 border-cream-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">New Products</span>
              </label>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => toggleFilterSection('dimensions')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-700 mb-2"
          >
            <span>Dimensions</span>
            {expandedSections.dimensions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedSections.dimensions && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seat Height (inches)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.min_seat_height}
                    onChange={(e) => updateFilter('min_seat_height', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.max_seat_height}
                    onChange={(e) => updateFilter('max_seat_height', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Width (inches)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.min_width}
                    onChange={(e) => updateFilter('min_width', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.max_width}
                    onChange={(e) => updateFilter('max_width', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Availability</label>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Lead Time (days)</label>
              <input
                type="number"
                placeholder="e.g., 30"
                value={filters.max_lead_time}
                onChange={(e) => updateFilter('max_lead_time', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stock Status</label>
              <select
                value={filters.stock_status}
                onChange={(e) => updateFilter('stock_status', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All</option>
                <option value="In Stock">In Stock</option>
                <option value="Made to Order">Made to Order</option>
                <option value="Custom Only">Custom Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
