import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Filter, X, ChevronDown, ChevronUp, ArrowUpDown, Search, Folder, Grid3x3, Users } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import ProductFamilyCard from '../components/ui/ProductFamilyCard';
import ProductFamilyQuickView from '../components/ui/ProductFamilyQuickView';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickViewModal from '../components/ui/QuickViewModal';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import productService from '../services/productService';
import useDebounce from '../hooks/useDebounce';
import logger from '../utils/logger';

const CONTEXT = 'ProductCatalogPage';

/**
 * Product Catalog Page
 * 
 * Features:
 * - Product families displayed first
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
  const [quickViewFamily, setQuickViewFamily] = useState(null);
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
    limit: 20,
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

  // Update category filter when URL params change
  useEffect(() => {
    if (categoryParam) {
      const category = categories.find(c => c.slug === categoryParam);
      if (category) {
        setFilters(prev => ({ ...prev, category_id: category.id }));
      }
    }
  }, [categoryParam, categories]);

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

  const handleFamilyQuickView = (family) => {
    setQuickViewFamily(family);
    logger.info(CONTEXT, `Opening family quick view for: ${family.name}`);
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

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-slate-600">
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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">
            {activeCategory ? activeCategory.name : 'All Products'}
          </h1>
          {activeCategory && activeCategory.description && (
            <p className="text-lg text-slate-600">{activeCategory.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-6 lg:gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden w-full mb-4 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              <Filter className="w-4 h-4" />
              {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
              {hasActiveFilters && (
                <span className="bg-white text-primary-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>

            <div className={`rounded-xl shadow-lg bg-white border border-cream-200 ${
              showMobileFilters ? 'block' : 'hidden lg:block'
            } lg:sticky lg:top-24 overflow-hidden`}>
              {/* Filter Header */}
              <div className="flex items-center justify-between p-5 border-b border-cream-200 bg-cream-50">
                <h2 className="text-xl font-bold text-slate-800">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="p-5 space-y-4 max-h-[calc(100vh-16rem)] lg:max-h-[calc(100vh-12rem)] overflow-y-auto">
                {/* Sort By - Moved to Top */}
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
                    <option value="price-asc">Price (Low to High)</option>
                    <option value="price-desc">Price (High to Low)</option>
                  </select>
                </div>

                {/* Search */}
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
                      Searching for "{debouncedSearch}"...
                    </p>
                  )}
                </div>

                {/* Categories */}
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
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                          !filters.category_id
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
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                            filters.category_id === category.id || filters.category_id === String(category.id)
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

                {/* Subcategories */}
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
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                              filters.subcategory_id === subcat.id || filters.subcategory_id === String(subcat.id)
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

                {/* Product Families */}
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
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        <button
                          onClick={() => updateFilter('family_id', '')}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                            !filters.family_id
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
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                              filters.family_id === family.id || filters.family_id === String(family.id)
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

                {/* Material Filters */}
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
                      {/* Finishes */}
                      {showFinishFilter && finishes.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            Finishes
                          </label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
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

                      {/* Upholstery */}
                      {showUpholsteryFilter && upholsteries.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            Upholstery
                          </label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
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

                      {/* Colors */}
                      {colors.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            Colors
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {colors.slice(0, 12).map((color) => (
                              <button
                                key={color.id}
                                onClick={() => toggleArrayFilter('color_ids', String(color.id))}
                                className={`w-full aspect-square rounded-lg border-2 transition-all ${
                                  filters.color_ids.includes(String(color.id))
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

                {/* Features */}
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

                {/* Dimensions */}
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
                      {/* Seat Height */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Seat Height (inches)
                        </label>
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

                      {/* Width */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Width (inches)
                        </label>
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

                {/* Availability */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Availability
                  </label>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Max Lead Time (days)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g., 30"
                        value={filters.max_lead_time}
                        onChange={(e) => updateFilter('max_lead_time', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-cream-300 bg-white rounded focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Stock Status
                      </label>
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
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-1">
            {/* Product Families Section - Only show when NO filters/search active */}
            {!loading && families.length > 0 && !filters.family_id && !hasActiveFilters && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Product Families
                  </h2>
                  <span className="text-sm text-slate-600">
                    {families.length} {families.length === 1 ? 'family' : 'families'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                  {families.map((family) => (
                    <div key={family.id}>
                      <ProductFamilyCard 
                        family={family}
                        onQuickView={handleFamilyQuickView}
                      />
                    </div>
                  ))}
                </div>

                <div className="border-t border-cream-300 pt-8 mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">
                    All Products
                  </h2>
                </div>
              </div>
            )}

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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 xl:gap-8 mb-8">
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
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex gap-1">
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
                              className={`px-3 py-1 rounded ${
                                page === pagination.page
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
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                    >
                      Next
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

      <ProductFamilyQuickView
        family={quickViewFamily}
        isOpen={!!quickViewFamily}
        onClose={() => setQuickViewFamily(null)}
      />
    </div>
  );
};

export default ProductCatalogPage;
