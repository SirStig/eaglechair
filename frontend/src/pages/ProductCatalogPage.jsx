import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickViewModal from '../components/ui/QuickViewModal';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import SEOHead from '../components/SEOHead';
import productService from '../services/productService';
import useDebounce from '../hooks/useDebounce';
import logger from '../utils/logger';
import FilterSidebar from '../components/products/FilterSidebar';

const CONTEXT = 'ProductCatalogPage';

/**
 * Product Catalog Page
 * 
 * Features:
 * - Smart sorting: featured → new → popular (view_count) → rest
 * - Comprehensive filters: categories, subcategories, families, colors, finishes, 
 *   upholstery, lead time, dimensions, stackable, etc.
 * - Dynamic filter visibility based on category/subcategory selection
 * - Responsive filter panel with mobile support
 * - Excludes product variations (shows only base products)
 */
const ProductCatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { category: categoryParam, subcategory: subcategoryParam } = useParams();

  // State
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

  // Filter panel expansion states
  const [expandedSections, setExpandedSections] = useState({
    category: false,
    subcategory: false,
    family: false,
    filters: false,
    dimensions: false,
    features: false,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0
  });

  // Comprehensive filters from URL params
  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    subcategory_id: searchParams.get('subcategory_id') || '',
    family_id: searchParams.get('family_id') || '',
    search: searchParams.get('search') || '',

    // Material filters
    finish_ids: searchParams.get('finish_ids')?.split(',').filter(Boolean) || [],
    upholstery_ids: searchParams.get('upholstery_ids')?.split(',').filter(Boolean) || [],
    color_ids: searchParams.get('color_ids')?.split(',').filter(Boolean) || [],

    // Feature filters
    is_stackable: searchParams.get('is_stackable') === 'true' || null,
    is_outdoor_suitable: searchParams.get('is_outdoor_suitable') === 'true' || null,
    ada_compliant: searchParams.get('ada_compliant') === 'true' || null,

    // Dimension filters
    min_seat_height: searchParams.get('min_seat_height') || '',
    max_seat_height: searchParams.get('max_seat_height') || '',
    min_width: searchParams.get('min_width') || '',
    max_width: searchParams.get('max_width') || '',

    // Availability filters
    max_lead_time: searchParams.get('max_lead_time') || '',
    stock_status: searchParams.get('stock_status') || '',

    // Quick filters
    featured: searchParams.get('featured') === 'true' || false,
    new: searchParams.get('new') === 'true' || false,

    sortBy: searchParams.get('sort') || 'smart', // Default to smart sorting
  });

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebounce(filters.search, 300);

  // Load initial data
  useEffect(() => {
    loadCategories();
    loadFilterOptions();
  }, []);

  // Load families and products when filters change
  useEffect(() => {
    loadFamilies();
    loadProducts();
    // Note: Dependencies managed carefully - only reload when debounced search or other filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.category_id, filters.subcategory_id, filters.family_id, filters.finish_ids, filters.upholstery_ids, filters.color_ids, filters.is_stackable, filters.is_outdoor_suitable, filters.ada_compliant, filters.min_seat_height, filters.max_seat_height, filters.min_width, filters.max_width, filters.max_lead_time, filters.stock_status, filters.featured, filters.new, filters.sortBy, pagination.page]);

  useEffect(() => {
    if (!categoryParam) return;
    if (categories.length === 0) return;
    const category = categories.find(c => c.slug === categoryParam);
    if (category) {
      setFilters(prev => ({ ...prev, category_id: category.id, subcategory_id: '' }));
      setExpandedSections(prev => (prev.category ? prev : { ...prev, category: true }));
    }
  }, [categoryParam, categories]);

  useEffect(() => {
    if (subcategoryParam && subcategories.length > 0) {
      const subcat = subcategories.find(s => (s.slug || '').toLowerCase() === subcategoryParam.toLowerCase());
      if (subcat) {
        setFilters(prev => ({ ...prev, subcategory_id: subcat.id }));
        setExpandedSections(prev => (prev.subcategory ? prev : { ...prev, subcategory: true }));
      }
    } else if (categoryParam && !subcategoryParam) {
      setFilters(prev => (prev.subcategory_id ? { ...prev, subcategory_id: '' } : prev));
    }
  }, [subcategoryParam, categoryParam, subcategories]);

  // Load subcategories when category changes
  useEffect(() => {
    if (filters.category_id) {
      loadSubcategories(filters.category_id);
    } else {
      setSubcategories([]);
    }
  }, [filters.category_id]);

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
        category_id: categoryId
      });
      setSubcategories(Array.isArray(subcategoriesData) ? subcategoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading subcategories', error);
      setSubcategories([]);
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Load finishes, upholsteries, and colors in parallel
      const [finishesData, upholsteriesData, colorsData] = await Promise.all([
        productService.getFinishes(),
        productService.getUpholsteries(),
        productService.getColors()
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
        page: pagination.page,
        per_page: pagination.limit,
        exclude_variations: true, // Only show base products
      };

      // Category/Subcategory filters
      if (filters.category_id) {
        params.category_id = parseInt(filters.category_id, 10);
      }

      if (filters.subcategory_id) {
        params.subcategory_id = parseInt(filters.subcategory_id, 10);
      }

      if (filters.family_id) {
        params.family_id = parseInt(filters.family_id, 10);
      }

      // Search - use debounced value
      if (debouncedSearch && debouncedSearch.trim() !== '') {
        params.search = debouncedSearch.trim();
      }

      // Material filters
      if (filters.finish_ids.length > 0) {
        params.finish_ids = filters.finish_ids.join(',');
      }

      if (filters.upholstery_ids.length > 0) {
        params.upholstery_ids = filters.upholstery_ids.join(',');
      }

      if (filters.color_ids.length > 0) {
        params.color_ids = filters.color_ids.join(',');
      }

      // Feature filters
      if (filters.is_stackable !== null) {
        params.stackable = filters.is_stackable;
      }

      if (filters.is_outdoor_suitable !== null) {
        params.outdoor = filters.is_outdoor_suitable;
      }

      if (filters.ada_compliant !== null) {
        params.ada_compliant = filters.ada_compliant;
      }

      // Dimension filters
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

      // Availability filters
      if (filters.max_lead_time) {
        params.max_lead_time = parseInt(filters.max_lead_time, 10);
      }

      if (filters.stock_status === 'In Stock') {
        params.in_stock_only = true;
      }

      // Quick filters
      if (filters.featured) {
        params.featured = true;
      }

      if (filters.new) {
        params.new = true;
      }

      // Sorting - use smart sort by default
      if (filters.sortBy === 'smart') {
        params.smart_sort = true;
      } else if (filters.sortBy) {
        params.sort = filters.sortBy;
      }

      const response = await productService.getProducts(params);

      let productsData = response.data || [];

      logger.debug(CONTEXT, `Loaded ${response.total} products`, response);

      setProducts(productsData);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
        pages: response.pages || 0
      }));
    } catch (error) {
      logger.error(CONTEXT, 'Error loading products', error);
      setProducts([]);
      setPagination(prev => ({ ...prev, total: 0, pages: 0 }));
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, page: 1 }));

    // Update URL params
    updateURLParams(newFilters);
  };

  const updateURLParams = (newFilters) => {
    const params = new URLSearchParams();

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== false && value !== '' && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          params.set(key, value.join(','));
        } else if (!Array.isArray(value)) {
          params.set(key, value);
        }
      }
    });

    setSearchParams(params);
  };

  const clearFilters = () => {
    const clearedFilters = {
      category_id: '',
      subcategory_id: '',
      family_id: '',
      search: '',
      finish_ids: [],
      upholstery_ids: [],
      color_ids: [],
      is_stackable: null,
      is_outdoor_suitable: null,
      ada_compliant: null,
      min_seat_height: '',
      max_seat_height: '',
      min_width: '',
      max_width: '',
      max_lead_time: '',
      stock_status: '',
      featured: false,
      new: false,
      sortBy: 'smart',
    };

    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({});
  };

  const toggleFilterSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleArrayFilter = (filterKey, value) => {
    const currentValues = filters[filterKey] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    updateFilter(filterKey, newValues);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
    logger.info(CONTEXT, `Opening quick view for: ${product.name}`);
  };


  // Get active category details
  const activeCategory = categories.find(c => c.id === parseInt(filters.category_id));

  // Check if any filters are active
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
    filters.new;

  // Determine which filter options to show based on category
  const showFinishFilter = !filters.category_id || activeCategory?.name !== 'Tables';
  const showUpholsteryFilter = !filters.category_id || ['Chairs', 'Booths', 'Bar Stools'].includes(activeCategory?.name);
  const showStackableFilter = !filters.category_id || activeCategory?.name === 'Chairs';
  const showOutdoorFilter = true; // All categories can have outdoor options

  // Generate SEO data
  const seoTitle = useMemo(() => {
    if (activeCategory) {
      return activeCategory.meta_title || `${activeCategory.name} | Eagle Chair`;
    }
    return 'Product Catalog | Eagle Chair';
  }, [activeCategory]);

  const seoDescription = useMemo(() => {
    if (activeCategory && activeCategory.description) {
      return activeCategory.meta_description || activeCategory.description.substring(0, 160);
    }
    return 'Browse our complete catalog of premium commercial seating solutions. Chairs, tables, booths, and more for restaurants, hotels, and hospitality venues.';
  }, [activeCategory]);

  const catalogUrl = useMemo(() => {
    if (categoryParam && subcategoryParam) {
      return `/products/category/${categoryParam}/${subcategoryParam}`;
    } else if (categoryParam) {
      return `/products/category/${categoryParam}`;
    }
    return '/products';
  }, [categoryParam, subcategoryParam]);

  const catalogSchema = useMemo(() => {
    const breadcrumbItems = [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.eaglechair.com/" },
      { "@type": "ListItem", "position": 2, "name": "Products", "item": "https://www.eaglechair.com/products" }
    ];

    if (activeCategory) {
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": 3,
        "name": activeCategory.name,
        "item": `https://www.eaglechair.com${catalogUrl}`
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": activeCategory ? activeCategory.name : "Product Catalog",
      "description": seoDescription,
      "url": `https://www.eaglechair.com${catalogUrl}`,
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems
      }
    };
  }, [activeCategory, catalogUrl, seoDescription]);

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image="/og-image.jpg"
        url={catalogUrl}
        type="website"
        keywords={activeCategory?.meta_keywords || 'commercial seating, restaurant furniture, Eagle Chair'}
        canonical={catalogUrl}
        structuredData={catalogSchema}
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Breadcrumb */}
        <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600 overflow-x-auto pb-2">
          <div className="flex items-center whitespace-nowrap min-w-fit">
            <span className="cursor-pointer hover:text-primary-500" onClick={() => navigate('/')}>
              Home
            </span>
            {' '}/{' '}
            <span className="cursor-pointer hover:text-primary-500" onClick={() => navigate('/products')}>
              Products
            </span>
            {activeCategory && (
              <>
                {' '}/{' '}
                <span className="text-slate-800">{activeCategory.name}</span>
              </>
            )}
            {subcategoryParam && (
              <>
                {' '}/{' '}
                <span className="text-slate-800">{subcategoryParam}</span>
              </>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-slate-800">
            {activeCategory ? activeCategory.name : 'All Products'}
          </h1>
          {activeCategory && activeCategory.description && (
            <p className="text-base sm:text-lg text-slate-600">{activeCategory.description}</p>
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

          {/* Main Content */}
          <main className="lg:col-span-1">

            {/* Products Grid */}
            {loading ? (
              <CardGridSkeleton count={9} columns={3} />
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md border border-cream-200 p-12 text-center">
                <svg className="mx-auto h-24 w-24 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold mb-2 text-slate-800">No products found</h3>
                <p className="text-slate-600 mb-4">
                  Try adjusting your filters or search terms
                </p>
                <Button onClick={clearFilters} variant="primary">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                {/* Results Summary */}
                <div className="mb-4 flex items-center justify-between text-sm text-slate-600">
                  <div>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} product{pagination.total !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 xl:gap-8 mb-8">
                  {products.map((product) => (
                    <div key={product.id} className="h-full">
                      <ProductCard
                        product={product}
                        onQuickView={handleQuickView}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.page === 1}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      Previous
                    </Button>

                    <div className="flex flex-wrap gap-1 justify-center">
                      {[...Array(pagination.pages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === pagination.pages ||
                          (page >= pagination.page - 1 && page <= pagination.page + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-2 rounded min-w-[44px] min-h-[44px] text-sm font-medium transition-colors ${page === pagination.page
                                  ? 'bg-primary-500 text-white font-semibold'
                                  : 'bg-white text-slate-700 hover:bg-cream-100 border border-cream-300'
                                }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === pagination.page - 2 ||
                          page === pagination.page + 2
                        ) {
                          return <span key={page} className="px-2 py-2 flex items-center">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="min-h-[44px] min-w-[80px]"
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.pages)}
                      disabled={pagination.page === pagination.pages}
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

      {/* Quick View Modals */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />

    </div>
  );
};

export default ProductCatalogPage;
