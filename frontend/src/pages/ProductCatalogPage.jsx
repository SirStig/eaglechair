import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { Filter, SearchX, SlidersHorizontal } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import EmptyResults from '../components/ui/EmptyResults';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import SEOHead from '../components/SEOHead';
import SEO from '../config/seoConfig';
import { shareImageUrl } from '../config/site';
import { breadcrumbSchema, categorySeo } from '../utils/seoSchema';
import productService from '../services/productService';
import useDebounce from '../hooks/useDebounce';
import logger from '../utils/logger';
import FilterSidebar from '../components/products/FilterSidebar';
import QuickViewModal from '../components/ui/QuickViewModal';
import {
  DEFAULT_CATALOG_FILTERS,
  CATALOG_PAGE_SIZES,
  resolveCatalogFilters,
  getCatalogPage,
  getCatalogLocation,
} from '../utils/catalogUrl';
import { findCategoryById, findNestedCategoryById } from '../utils/categoryTree';
import { trackFilter } from '../utils/analytics';

const CONTEXT = 'ProductCatalogPage';
// The products API caps per_page at 100, so "See all" fetches 100-item pages
const MAX_API_PAGE_SIZE = 100;

// Card image widths on the live grid: 2 columns on phones, 3 from md (beside
// the filter sidebar from lg), 4 at xl, 5 from 1700px.
const CATALOG_CARD_IMAGE_SIZES =
  '(min-width: 1700px) calc((100vw - 560px) / 5), (min-width: 1280px) calc((100vw - 540px) / 4), (min-width: 1024px) calc((100vw - 440px) / 3), (min-width: 768px) calc((100vw - 96px) / 3), calc(50vw - 40px)';
// Cards that are on screen at load (one row on the widest grid)
const FIRST_ROW_CARDS = 5;

const PAGE_SIZE_LABELS = { all: 'All' };

// Analytics: which catalog filters people apply. Category / subcategory
// changes are page views of their own, and the search box is tracked once
// typing settles, so neither is repeated here.
const FILTER_FACETS = {
  family_id: 'Family',
  finish_ids: 'Finish',
  upholstery_ids: 'Upholstery',
  color_ids: 'Color',
  is_stackable: 'Stackable',
  is_outdoor_suitable: 'Outdoor',
  ada_compliant: 'ADA compliant',
  min_seat_height: 'Min seat height',
  max_seat_height: 'Max seat height',
  min_width: 'Min width',
  max_width: 'Max width',
  max_lead_time: 'Max lead time',
  stock_status: 'Stock status',
  featured: 'Featured',
  new: 'New',
  sortBy: 'Sort',
};

function trackFilterChanges(prev, next, { families, finishes, upholsteries, colors }) {
  const nameOf = (list, id) => list.find((item) => String(item.id) === String(id))?.name || `#${id}`;
  const lists = { family_id: families, finish_ids: finishes, upholstery_ids: upholsteries, color_ids: colors };
  Object.entries(FILTER_FACETS).forEach(([key, facet]) => {
    const before = prev?.[key];
    const after = next?.[key];
    if (Array.isArray(after)) {
      const added = after.filter((id) => !(before || []).map(String).includes(String(id)));
      added.forEach((id) => trackFilter(facet, nameOf(lists[key], id)));
      return;
    }
    if (after === before || after === '' || after === null || after === false || after === undefined) return;
    if (after === true) trackFilter(facet, 'Yes');
    else trackFilter(facet, lists[key] ? nameOf(lists[key], after) : after);
  });
}

const ProductCatalogPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { category: categoryParam, subcategory: subcategoryParam } = useParams();

  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [resultMeta, setResultMeta] = useState({ total: 0, pages: 0 });

  const [expandedSections, setExpandedSections] = useState({
    category: false,
    subcategory: false,
    family: false,
    filters: false,
    dimensions: false,
    features: false,
  });

  const filters = useMemo(
    () =>
      resolveCatalogFilters({
        searchParams,
        categoryParam,
        subcategoryParam,
        categories,
        subcategories,
      }),
    [searchParams, categoryParam, subcategoryParam, categories, subcategories]
  );

  const showAll = filters.per_page === 'all';
  const pageSize = showAll ? null : filters.per_page;
  const page = showAll ? 1 : getCatalogPage(searchParams);

  const debouncedSearch = useDebounce(filters.search, 300);

  const goToCatalog = useCallback(
    (nextFilters, nextPage = 1, options = {}) => {
      trackFilterChanges(filters, nextFilters, { families, finishes, upholsteries, colors });
      const { pathname, search } = getCatalogLocation(
        nextFilters,
        categories,
        subcategories,
        nextPage
      );
      navigate({ pathname, search }, options);
    },
    [navigate, categories, subcategories, filters, families, finishes, upholsteries, colors]
  );

  // Catalog search box: one event once typing settles
  const settledSearch = useDebounce((filters.search || '').trim().toLowerCase(), 1200);
  useEffect(() => {
    if (settledSearch.length >= 2) trackFilter('Catalog search', settledSearch);
  }, [settledSearch]);

  // Request sequence numbers: a slower, older response must never overwrite
  // the results for the current filters.
  const productsRequestRef = useRef(0);
  const familiesRequestRef = useRef(0);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    loadCategories();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (categoryParam || !searchParams.get('category_id') || categories.length === 0) {
      return;
    }
    const legacySubId = searchParams.get('subcategory_id');
    if (legacySubId && subcategories.length === 0) {
      return;
    }
    const legacyFilters = resolveCatalogFilters({
      searchParams,
      categoryParam: null,
      subcategoryParam: null,
      categories,
      subcategories,
    });
    const { pathname, search } = getCatalogLocation(legacyFilters, categories, subcategories, page);
    navigate({ pathname, search }, { replace: true });
  }, [categoryParam, categories, searchParams, subcategories, page, navigate]);

  useEffect(() => {
    if (categoryParam) {
      setExpandedSections((prev) => (prev.category ? prev : { ...prev, category: true }));
    }
    if (subcategoryParam) {
      setExpandedSections((prev) => (prev.subcategory ? prev : { ...prev, subcategory: true }));
    }
  }, [categoryParam, subcategoryParam]);

  useEffect(() => {
    // When a nested category is selected we still list its parent's children,
    // so the sidebar keeps showing its siblings.
    const nested = findNestedCategoryById(categories, filters.category_id);
    const childListCategoryId = nested ? nested.parent.id : filters.category_id;

    if (childListCategoryId) {
      loadSubcategories(childListCategoryId);
    } else {
      setSubcategories([]);
    }
  }, [filters.category_id, categories]);

  // A /products/category/:slug URL can't be turned into a category_id until
  // categories load; fetching before that returns the unfiltered catalog.
  const waitingForCategorySlug = Boolean(categoryParam) && !categoriesLoaded;

  useEffect(() => {
    if (waitingForCategorySlug) return;
    loadFamilies();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waitingForCategorySlug,
    debouncedSearch,
    filters.category_id,
    filters.subcategory_id,
    filters.family_id,
    filters.finish_ids,
    filters.upholstery_ids,
    filters.color_ids,
    filters.is_stackable,
    filters.is_outdoor_suitable,
    filters.ada_compliant,
    filters.min_seat_height,
    filters.max_seat_height,
    filters.min_width,
    filters.max_width,
    filters.max_lead_time,
    filters.stock_status,
    filters.featured,
    filters.new,
    filters.sortBy,
    filters.per_page,
    page,
  ]);

  const loadCategories = async () => {
    try {
      const categoriesData = await productService.getCategories();
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories', error);
      setCategories([]);
    } finally {
      setCategoriesLoaded(true);
    }
  };

  const loadSubcategories = async (categoryId) => {
    try {
      const subcategoriesData = await productService.getSubcategories({
        category_id: categoryId,
      });
      setSubcategories(Array.isArray(subcategoriesData) ? subcategoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading subcategories', error);
      setSubcategories([]);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [finishesData, upholsteriesData, colorsData] = await Promise.all([
        productService.getFinishes(),
        productService.getUpholsteries(),
        productService.getColors(),
      ]);

      setFinishes(Array.isArray(finishesData) ? finishesData : []);
      setUpholsteries(Array.isArray(upholsteriesData) ? upholsteriesData : []);
      setColors(Array.isArray(colorsData) ? colorsData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading filter options', error);
    }
  };

  const loadFamilies = async () => {
    const requestId = ++familiesRequestRef.current;
    try {
      const params = {};

      if (filters.category_id) {
        params.category_id = parseInt(filters.category_id, 10);
      }

      if (filters.featured) {
        params.featured_only = true;
      }

      const familiesData = await productService.getFamilies(params);
      if (requestId !== familiesRequestRef.current) return;
      setFamilies(Array.isArray(familiesData) ? familiesData : []);
    } catch (error) {
      if (requestId !== familiesRequestRef.current) return;
      logger.error(CONTEXT, 'Error loading families', error);
      setFamilies([]);
    }
  };

  const loadProducts = async () => {
    const requestId = ++productsRequestRef.current;
    setLoading(true);

    try {
      const params = {
        page,
        per_page: showAll ? MAX_API_PAGE_SIZE : pageSize,
        exclude_variations: true,
      };

      if (filters.category_id) {
        params.category_id = parseInt(filters.category_id, 10);
      }

      if (filters.subcategory_id) {
        params.subcategory_id = parseInt(filters.subcategory_id, 10);
      }

      if (filters.family_id) {
        params.family_id = parseInt(filters.family_id, 10);
      }

      if (debouncedSearch && debouncedSearch.trim() !== '') {
        params.search = debouncedSearch.trim();
      }

      if (filters.finish_ids.length > 0) {
        params.finish_ids = filters.finish_ids.join(',');
      }

      if (filters.upholstery_ids.length > 0) {
        params.upholstery_ids = filters.upholstery_ids.join(',');
      }

      if (filters.color_ids.length > 0) {
        params.color_ids = filters.color_ids.join(',');
      }

      if (filters.is_stackable !== null) {
        params.stackable = filters.is_stackable;
      }

      if (filters.is_outdoor_suitable !== null) {
        params.outdoor = filters.is_outdoor_suitable;
      }

      if (filters.ada_compliant !== null) {
        params.ada_compliant = filters.ada_compliant;
      }

      if (filters.min_seat_height) {
        params.min_seat_height = parseFloat(filters.min_seat_height);
      }

      if (filters.max_seat_height) {
        params.max_seat_height = parseFloat(filters.max_seat_height);
      }

      if (filters.min_width) {
        params.min_width = parseFloat(filters.min_width);
      }

      if (filters.max_width) {
        params.max_width = parseFloat(filters.max_width);
      }

      if (filters.max_lead_time) {
        params.max_lead_time = parseInt(filters.max_lead_time, 10);
      }

      if (filters.stock_status === 'In Stock') {
        params.in_stock_only = true;
      }

      if (filters.featured) {
        params.featured = true;
      }

      if (filters.new) {
        params.new = true;
      }

      if (filters.sortBy === 'smart') {
        params.smart_sort = true;
      } else if (filters.sortBy) {
        params.sort = filters.sortBy;
      }

      const response = await productService.getProducts(params);
      if (requestId !== productsRequestRef.current) return;

      let items = response.data || [];
      if (showAll && response.pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: response.pages - 1 }, (_, i) =>
            productService.getProducts({ ...params, page: i + 2 })
          )
        );
        if (requestId !== productsRequestRef.current) return;
        items = items.concat(...rest.map((r) => r.data || []));
      }

      logger.debug(CONTEXT, `Loaded ${response.total} products`, response);

      setProducts(items);
      setResultMeta({
        total: response.total || 0,
        pages: showAll ? 1 : response.pages || 0,
      });
    } catch (error) {
      if (requestId !== productsRequestRef.current) return;
      logger.error(CONTEXT, 'Error loading products', error);
      setProducts([]);
      setResultMeta({ total: 0, pages: 0 });
    } finally {
      if (requestId === productsRequestRef.current) setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };

    if (key === 'category_id') {
      newFilters.subcategory_id = '';
    }

    goToCatalog(newFilters, 1, key === 'search' ? { replace: true } : undefined);
  };

  // Clearing filters keeps the visitor's chosen page size
  const clearFilters = () => {
    goToCatalog({ ...DEFAULT_CATALOG_FILTERS, per_page: filters.per_page }, 1);
  };

  const handlePageSizeChange = (size) => {
    if (size === filters.per_page) return;
    goToCatalog({ ...filters, per_page: size }, 1);
  };

  const toggleFilterSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleArrayFilter = (filterKey, value) => {
    const currentValues = filters[filterKey] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];

    updateFilter(filterKey, newValues);
  };

  const handlePageChange = (newPage) => {
    goToCatalog(filters, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
    logger.info(CONTEXT, `Opening quick view for: ${product.name}`);
  };

  // The active "child" is either a subcategory or a nested category; a nested
  // category filters by category_id but still renders as a child of its parent.
  const activeNestedCategory = findNestedCategoryById(categories, filters.category_id);
  const activeCategory = activeNestedCategory
    ? activeNestedCategory.parent
    : findCategoryById(categories, filters.category_id);
  const activeSubcategory = activeNestedCategory
    ? activeNestedCategory.category
    : subcategories.find((s) => String(s.id) === String(filters.subcategory_id));

  // Clearing the child filter falls back to the parent category
  const filtersWithoutChild = {
    ...filters,
    subcategory_id: '',
    category_id: activeCategory?.id || '',
  };

  const productsBreadcrumbPath = getCatalogLocation(
    { ...filters, category_id: '', subcategory_id: '' },
    categories,
    subcategories,
    page
  );

  const hasActiveFilters =
    filters.category_id ||
    filters.subcategory_id ||
    filters.family_id ||
    filters.search ||
    filters.finish_ids.length > 0 ||
    filters.upholstery_ids.length > 0 ||
    filters.color_ids.length > 0 ||
    filters.is_stackable !== null ||
    filters.is_outdoor_suitable !== null ||
    filters.ada_compliant !== null ||
    filters.min_seat_height ||
    filters.max_seat_height ||
    filters.min_width ||
    filters.max_width ||
    filters.max_lead_time ||
    filters.stock_status ||
    filters.featured ||
    filters.new ||
    filters.sortBy !== 'smart';

  const showFinishFilter = !filters.category_id || activeCategory?.name !== 'Tables';
  const showUpholsteryFilter =
    !filters.category_id || ['Chairs', 'Booths', 'Bar Stools'].includes(activeCategory?.name);
  const showStackableFilter = !filters.category_id || activeCategory?.name === 'Chairs';
  const showOutdoorFilter = true;

  // SEO: same title/description/JSON-LD as the prerendered shell (utils/seoSchema.js)
  const seoCategory = activeSubcategory || activeCategory;
  const seo = useMemo(() => {
    if (!seoCategory) {
      return {
        ...SEO.pages.products,
        path: '/products',
        structuredData: breadcrumbSchema([['Home', '/'], ['Products', '/products']]),
      };
    }
    return categorySeo(seoCategory, activeSubcategory ? activeCategory : null);
  }, [seoCategory, activeSubcategory, activeCategory]);

  const pageTitle = activeSubcategory?.name || activeCategory?.name || 'All Products';

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <SEOHead
        title={seo.title}
        description={seo.description}
        image={seoCategory ? shareImageUrl('category', seoCategory.slug) : undefined}
        imageAlt={seo.imageAlt}
        url={seo.path}
        structuredData={seo.structuredData}
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600 overflow-x-auto pb-2"
        >
          <ol className="flex items-center whitespace-nowrap min-w-fit list-none m-0 p-0">
            <li>
              <Link to="/" className="hover:text-primary-500">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="mx-1">
              /
            </li>
            <li>
              <Link
                to={{ pathname: '/products', search: productsBreadcrumbPath.search }}
                className="hover:text-primary-500"
              >
                Products
              </Link>
            </li>
            {activeCategory && (
              <>
                <li aria-hidden="true" className="mx-1">
                  /
                </li>
                <li>
                  {activeSubcategory ? (
                    <Link
                      to={getCatalogLocation(
                        filtersWithoutChild,
                        categories,
                        subcategories,
                        1
                      )}
                      className="hover:text-primary-500"
                    >
                      {activeCategory.name}
                    </Link>
                  ) : (
                    <span className="text-slate-800">{activeCategory.name}</span>
                  )}
                </li>
              </>
            )}
            {activeSubcategory && (
              <>
                <li aria-hidden="true" className="mx-1">
                  /
                </li>
                <li>
                  <span className="text-slate-800">{activeSubcategory.name}</span>
                </li>
              </>
            )}
          </ol>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-slate-800">
            {pageTitle}
          </h1>
          {(activeSubcategory?.description || activeCategory?.description) && (
            <p className="text-base sm:text-lg text-slate-600">
              {activeSubcategory?.description || activeCategory?.description}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-6 lg:gap-8">
          {showMobileFilters && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowMobileFilters(false)}
            />
          )}

          <aside className="lg:col-span-1">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden w-full mb-4 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md min-h-[44px] font-medium"
            >
              <Filter className="w-4 h-4" />
              {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
              {hasActiveFilters && (
                <span className="bg-white text-primary-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>

            <FilterSidebar
              filters={filters}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              expandedSections={expandedSections}
              toggleFilterSection={toggleFilterSection}
              toggleArrayFilter={toggleArrayFilter}
              categories={categories}
              subcategories={subcategories}
              families={families}
              finishes={finishes}
              upholsteries={upholsteries}
              colors={colors}
              debouncedSearch={debouncedSearch}
              showFinishFilter={showFinishFilter}
              showUpholsteryFilter={showUpholsteryFilter}
              showStackableFilter={showStackableFilter}
              showOutdoorFilter={showOutdoorFilter}
              showMobileFilters={showMobileFilters}
              onCloseMobile={() => setShowMobileFilters(false)}
            />
          </aside>

          <main className="lg:col-span-1">
            {loading ? (
              <CardGridSkeleton count={8} columns={4} />
            ) : products.length === 0 ? (
              <EmptyResults
                icon={filters.search ? SearchX : SlidersHorizontal}
                title={filters.search ? `No matches for “${filters.search}”` : 'No products match these filters'}
                message={filters.search
                  ? 'Try a different term, a model number, or clear your filters to see everything.'
                  : 'Try removing a filter or two to widen the results.'}
              >
                <Button onClick={clearFilters} variant="primary">
                  Clear All Filters
                </Button>
              </EmptyResults>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <div>
                    {showAll ? (
                      <>
                        Showing all {resultMeta.total} product{resultMeta.total !== 1 ? 's' : ''}
                      </>
                    ) : (
                      <>
                        Showing {(page - 1) * pageSize + 1} -{' '}
                        {Math.min(page * pageSize, resultMeta.total)} of {resultMeta.total} product
                        {resultMeta.total !== 1 ? 's' : ''}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2" role="group" aria-label="Products per page">
                    <span>Show</span>
                    <div className="inline-flex rounded-lg border border-cream-300 bg-white overflow-hidden">
                      {CATALOG_PAGE_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handlePageSizeChange(size)}
                          aria-pressed={filters.per_page === size}
                          className={`px-3 min-h-[36px] text-sm font-medium transition-colors border-l border-cream-300 first:border-l-0 ${
                            filters.per_page === size
                              ? 'bg-primary-500 text-white'
                              : 'text-slate-700 hover:bg-cream-100'
                          }`}
                        >
                          {PAGE_SIZE_LABELS[size] || size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 min-[1700px]:grid-cols-5 gap-4 md:gap-5 2xl:gap-6 mb-8">
                  {products.map((product, index) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onQuickView={handleQuickView}
                        imageSizes={CATALOG_CARD_IMAGE_SIZES}
                        priority={index < FIRST_ROW_CARDS}
                      />
                    </div>
                  ))}
                </div>

                {resultMeta.pages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={page === 1}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      Previous
                    </Button>

                    <div className="flex flex-wrap gap-1 justify-center">
                      {[...Array(resultMeta.pages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (
                          pageNum === 1 ||
                          pageNum === resultMeta.pages ||
                          (pageNum >= page - 1 && pageNum <= page + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-2 rounded min-w-[44px] min-h-[44px] text-sm font-medium transition-colors ${
                                pageNum === page
                                  ? 'bg-primary-500 text-white font-semibold'
                                  : 'bg-white text-slate-700 hover:bg-cream-100 border border-cream-300'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                        if (pageNum === page - 2 || pageNum === page + 2) {
                          return (
                            <span key={pageNum} className="px-2 py-2 flex items-center">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === resultMeta.pages}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(resultMeta.pages)}
                      disabled={page === resultMeta.pages}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      Last
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePageSizeChange('all')}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      See All
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default ProductCatalogPage;
