import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { Filter } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import SEOHead from '../components/SEOHead';
import productService from '../services/productService';
import useDebounce from '../hooks/useDebounce';
import logger from '../utils/logger';
import FilterSidebar from '../components/products/FilterSidebar';
import QuickViewModal from '../components/ui/QuickViewModal';
import {
  DEFAULT_CATALOG_FILTERS,
  resolveCatalogFilters,
  getCatalogPage,
  getCatalogLocation,
  buildCatalogPath,
} from '../utils/catalogUrl';

const CONTEXT = 'ProductCatalogPage';
const PAGE_SIZE = 25;

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

  const page = getCatalogPage(searchParams);

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

  const debouncedSearch = useDebounce(filters.search, 300);

  const goToCatalog = useCallback(
    (nextFilters, nextPage = 1, options = {}) => {
      const { pathname, search } = getCatalogLocation(
        nextFilters,
        categories,
        subcategories,
        nextPage
      );
      navigate({ pathname, search }, options);
    },
    [navigate, categories, subcategories]
  );

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
    if (filters.category_id) {
      loadSubcategories(filters.category_id);
    } else {
      setSubcategories([]);
    }
  }, [filters.category_id]);

  useEffect(() => {
    loadFamilies();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    page,
  ]);

  const loadCategories = async () => {
    try {
      const categoriesData = await productService.getCategories();
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories', error);
      setCategories([]);
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
    try {
      const params = {};

      if (filters.category_id) {
        params.category_id = parseInt(filters.category_id, 10);
      }

      if (filters.featured) {
        params.featured_only = true;
      }

      const familiesData = await productService.getFamilies(params);
      setFamilies(Array.isArray(familiesData) ? familiesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading families', error);
      setFamilies([]);
    }
  };

  const loadProducts = async () => {
    setLoading(true);

    try {
      const params = {
        page,
        per_page: PAGE_SIZE,
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

      logger.debug(CONTEXT, `Loaded ${response.total} products`, response);

      setProducts(response.data || []);
      setResultMeta({
        total: response.total || 0,
        pages: response.pages || 0,
      });
    } catch (error) {
      logger.error(CONTEXT, 'Error loading products', error);
      setProducts([]);
      setResultMeta({ total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };

    if (key === 'category_id') {
      newFilters.subcategory_id = '';
    }

    goToCatalog(newFilters, 1, key === 'search' ? { replace: true } : undefined);
  };

  const clearFilters = () => {
    goToCatalog({ ...DEFAULT_CATALOG_FILTERS }, 1);
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

  const activeCategory = categories.find((c) => String(c.id) === String(filters.category_id));
  const activeSubcategory = subcategories.find(
    (s) => String(s.id) === String(filters.subcategory_id)
  );

  const catalogPath = buildCatalogPath(activeCategory?.slug, activeSubcategory?.slug);
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

  const seoTitle = useMemo(() => {
    if (activeSubcategory?.meta_title) {
      return activeSubcategory.meta_title;
    }
    if (activeCategory) {
      return activeCategory.meta_title || `${activeCategory.name} | Eagle Chair`;
    }
    return 'Product Catalog | Eagle Chair';
  }, [activeCategory, activeSubcategory]);

  const seoDescription = useMemo(() => {
    if (activeSubcategory?.description) {
      return activeSubcategory.meta_description || activeSubcategory.description.substring(0, 160);
    }
    if (activeCategory?.description) {
      return activeCategory.meta_description || activeCategory.description.substring(0, 160);
    }
    return 'Browse our complete catalog of premium commercial seating solutions. Chairs, tables, booths, and more for restaurants, hotels, and hospitality venues.';
  }, [activeCategory, activeSubcategory]);

  const catalogSchema = useMemo(() => {
    const breadcrumbItems = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.eaglechair.com/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: 'https://www.eaglechair.com/products',
      },
    ];

    if (activeCategory) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 3,
        name: activeCategory.name,
        item: `https://www.eaglechair.com${buildCatalogPath(activeCategory.slug)}`,
      });
    }

    if (activeSubcategory) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: activeSubcategory.name,
        item: `https://www.eaglechair.com${catalogPath}`,
      });
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: activeSubcategory?.name || activeCategory?.name || 'Product Catalog',
      description: seoDescription,
      url: `https://www.eaglechair.com${catalogPath}`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    };
  }, [activeCategory, activeSubcategory, catalogPath, seoDescription]);

  const pageTitle = activeSubcategory?.name || activeCategory?.name || 'All Products';

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image="/og-image.jpg"
        url={catalogPath}
        type="website"
        keywords={activeCategory?.meta_keywords || 'commercial seating, restaurant furniture, Eagle Chair'}
        canonical={catalogPath}
        structuredData={catalogSchema}
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
                        { ...filters, subcategory_id: '' },
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
              <CardGridSkeleton count={9} columns={3} />
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md border border-cream-200 p-12 text-center">
                <svg
                  className="mx-auto h-24 w-24 text-slate-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="text-xl font-semibold mb-2 text-slate-800">No products found</h3>
                <p className="text-slate-600 mb-4">Try adjusting your filters or search terms</p>
                <Button onClick={clearFilters} variant="primary">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between text-sm text-slate-600">
                  <div>
                    Showing {(page - 1) * PAGE_SIZE + 1} -{' '}
                    {Math.min(page * PAGE_SIZE, resultMeta.total)} of {resultMeta.total} product
                    {resultMeta.total !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 xl:gap-8 mb-8">
                  {products.map((product) => (
                    <div key={product.id} className="h-full">
                      <ProductCard product={product} onQuickView={handleQuickView} />
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
