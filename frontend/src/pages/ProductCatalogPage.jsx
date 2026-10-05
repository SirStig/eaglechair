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
  subcategoryParentId,
} from '../utils/catalogUrl';
import {
  findCategoryById,
  findNestedCategoryById,
  getChildren,
  isNestedCategoryChild,
} from '../utils/categoryTree';
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
  upholstery_ids: 'Upholstery',
  color_ids: 'Color',
  is_stackable: 'Stackable',
  is_outdoor_suitable: 'Outdoor',
  ada_compliant: 'ADA compliant',
  min_height: 'Min height',
  max_height: 'Max height',
  min_width: 'Min width',
  max_width: 'Max width',
  stock_status: 'Stock status',
  featured: 'Featured',
  new: 'New',
  sortBy: 'Sort',
};

function trackFilterChanges(prev, next, { families, upholsteries, colors }) {
  const nameOf = (list, id) => list.find((item) => String(item.id) === String(id))?.name || `#${id}`;
  const lists = { family_id: families, upholstery_ids: upholsteries, color_ids: colors };
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
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [resultMeta, setResultMeta] = useState({ total: 0, pages: 0 });

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
      trackFilterChanges(filters, nextFilters, { families, upholsteries, colors });
      // Include every category's children so a subcategory picked under a
      // different parent than the current one still resolves to its slug.
      const { pathname, search } = getCatalogLocation(
        nextFilters,
        categories,
        [...subcategories, ...categories.flatMap(getChildren)],
        nextPage
      );
      navigate({ pathname, search }, options);
    },
    [navigate, categories, subcategories, filters, families, upholsteries, colors]
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
  const [categoryCounts, setCategoryCounts] = useState(null);

  // Categories for the filter panel, with live product counts merged in
  const sidebarCategories = useMemo(() => {
    if (!categoryCounts) return categories;
    const live = new Map(categoryCounts.map((c) => [String(c.id), c]));
    return categories.map((cat) => {
      const liveCat = live.get(String(cat.id));
      if (!liveCat) return cat;
      const childCounts = new Map(
        (liveCat.subcategories || []).map((c) => [`${c.type}-${c.id}`, c.product_count])
      );
      return {
        ...cat,
        has_products: liveCat.has_products,
        subcategories: (cat.subcategories || []).map((child) => ({
          ...child,
          product_count: childCounts.get(`${child.type}-${child.id}`) ?? child.product_count,
        })),
      };
    });
  }, [categories, categoryCounts]);

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

  const categoryIdsKey = filters.category_ids.join(',');
  const subcategoryIdsKey = filters.subcategory_ids.join(',');

  useEffect(() => {
    if (waitingForCategorySlug) return;
    loadFamilies();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waitingForCategorySlug,
    debouncedSearch,
    categoryIdsKey,
    subcategoryIdsKey,
    filters.family_id,
    filters.upholstery_ids,
    filters.color_ids,
    filters.is_stackable,
    filters.is_outdoor_suitable,
    filters.ada_compliant,
    filters.min_height,
    filters.max_height,
    filters.min_width,
    filters.max_width,
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
    // Live counts only feed the filter panel's hiding of empty categories;
    // without them every category stays visible.
    try {
      setCategoryCounts(await productService.getCategoriesWithCounts());
    } catch (error) {
      logger.error(CONTEXT, 'Error loading category counts', error);
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
      const [upholsteriesData, colorsData] = await Promise.all([
        productService.getUpholsteries(),
        productService.getColors(),
      ]);

      setUpholsteries(Array.isArray(upholsteriesData) ? upholsteriesData : []);
      setColors(Array.isArray(colorsData) ? colorsData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading filter options', error);
    }
  };

  const loadFamilies = async () => {
    const requestId = ++familiesRequestRef.current;
    setFamiliesLoading(true);
    try {
      const params = {};

      // Families belong to categories; a picked subcategory counts as its parent
      const familyCategoryIds = [
        ...new Set([
          ...filters.category_ids,
          ...filters.subcategory_ids.map((id) =>
            String(subcategoryParentId(id, categories, subcategories))
          ),
        ].filter(Boolean)),
      ];
      if (familyCategoryIds.length) {
        params.category_ids = familyCategoryIds.join(',');
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
    } finally {
      if (requestId === familiesRequestRef.current) setFamiliesLoading(false);
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

      // Several picks match products in any of them
      if (filters.category_ids.length) {
        params.category_ids = filters.category_ids.join(',');
      }

      if (filters.subcategory_ids.length) {
        params.subcategory_ids = filters.subcategory_ids.join(',');
      }

      if (filters.family_id) {
        params.family_id = parseInt(filters.family_id, 10);
      }

      if (debouncedSearch && debouncedSearch.trim() !== '') {
        params.search = debouncedSearch.trim();
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

      if (filters.min_height) {
        params.min_height = parseFloat(filters.min_height);
      }

      if (filters.max_height) {
        params.max_height = parseFloat(filters.max_height);
      }

      if (filters.min_width) {
        params.min_width = parseFloat(filters.min_width);
      }

      if (filters.max_width) {
        params.max_width = parseFloat(filters.max_width);
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

  const updateFilters = (changes) => {
    goToCatalog({ ...filters, ...changes }, 1);
  };

  // Toggle a category, or one of its children, in the selection. A nested
  // category child is a category id; a product subcategory is a subcategory
  // id. A parent and its own children are never picked together: the parent
  // already covers them.
  const toggleCategory = (parent, child) => {
    const has = (list, id) => list.some((v) => String(v) === String(id));
    let cats = [...filters.category_ids];
    let subs = [...filters.subcategory_ids];

    if (child) {
      const nestedChild = isNestedCategoryChild(child);
      const list = nestedChild ? cats : subs;
      const next = has(list, child.id)
        ? list.filter((v) => String(v) !== String(child.id))
        : [...list, String(child.id)];
      if (nestedChild) cats = next;
      else subs = next;
      cats = cats.filter((v) => String(v) !== String(parent.id));
    } else if (has(cats, parent.id)) {
      cats = cats.filter((v) => String(v) !== String(parent.id));
    } else {
      const children = getChildren(parent);
      const isChild = (type, id) =>
        children.some((c) => (c.type || 'subcategory') === type && String(c.id) === String(id));
      cats = [...cats.filter((id) => !isChild('category', id)), String(parent.id)];
      subs = subs.filter((id) => !isChild('subcategory', id));
    }

    goToCatalog({ ...filters, category_ids: cats, subcategory_ids: subs }, 1);
  };

  const clearCategories = () => {
    goToCatalog({ ...filters, category_ids: [], subcategory_ids: [] }, 1);
  };

  // Clearing filters keeps the visitor's chosen page size
  const clearFilters = () => {
    goToCatalog({ ...DEFAULT_CATALOG_FILTERS, per_page: filters.per_page }, 1);
  };

  const handlePageSizeChange = (size) => {
    if (size === filters.per_page) return;
    goToCatalog({ ...filters, per_page: size }, 1);
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
    category_ids: activeCategory ? [String(activeCategory.id)] : [],
    subcategory_ids: [],
  };

  const productsBreadcrumbPath = getCatalogLocation(
    { ...filters, category_ids: [], subcategory_ids: [] },
    categories,
    subcategories,
    page
  );

  const hasActiveFilters =
    filters.category_ids.length > 0 ||
    filters.subcategory_ids.length > 0 ||
    filters.family_id ||
    filters.search ||
    filters.upholstery_ids.length > 0 ||
    filters.color_ids.length > 0 ||
    filters.is_stackable !== null ||
    filters.is_outdoor_suitable !== null ||
    filters.ada_compliant !== null ||
    filters.min_height ||
    filters.max_height ||
    filters.min_width ||
    filters.max_width ||
    filters.stock_status ||
    filters.featured ||
    filters.new ||
    filters.sortBy !== 'smart';

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

  // Several categories picked: name them all
  const selectedCategoryNames = useMemo(() => {
    const children = categories.flatMap((cat) => getChildren(cat));
    const nameOf = (id, type) =>
      (type === 'category'
        ? findCategoryById(categories, id) || findNestedCategoryById(categories, id)?.category
        : children.find((c) => (c.type || 'subcategory') === 'subcategory' && String(c.id) === String(id))
      )?.name;
    return [
      ...filters.category_ids.map((id) => nameOf(id, 'category')),
      ...filters.subcategory_ids.map((id) => nameOf(id, 'subcategory')),
    ].filter(Boolean);
  }, [categories, filters.category_ids, filters.subcategory_ids]);

  const pageTitle =
    activeSubcategory?.name ||
    activeCategory?.name ||
    (selectedCategoryNames.length > 1 ? selectedCategoryNames.join(', ') : 'All Products');

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
              updateFilters={updateFilters}
              toggleCategory={toggleCategory}
              clearCategories={clearCategories}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              toggleArrayFilter={toggleArrayFilter}
              categories={sidebarCategories}
              families={families}
              familiesLoading={familiesLoading}
              upholsteries={upholsteries}
              colors={colors}
              showUpholsteryFilter={showUpholsteryFilter}
              showStackableFilter={showStackableFilter}
              showOutdoorFilter={showOutdoorFilter}
              showMobileFilters={showMobileFilters}
              onCloseMobile={() => setShowMobileFilters(false)}
              resultCount={resultMeta.total}
              loading={loading}
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
