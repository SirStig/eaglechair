import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Filter, X, ChevronDown, ChevronUp, ArrowUpDown, Search as SearchIcon, Grid3x3 } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import QuickViewModal from '../components/ui/QuickViewModal';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import productService from '../services/productService';
import useDebounce from '../hooks/useDebounce';
import logger from '../utils/logger';

const CONTEXT = 'SearchPage';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Filter panel expansion states
  const [expandedSections, setExpandedSections] = useState({
    category: true,
    sort: true,
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  // Filters
  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    sortBy: searchParams.get('sort') || 'relevance',
  });

  // Debounce search query
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  // Update local search query when URL changes
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Search products when query or filters change
  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filters.category_id, filters.sortBy, pagination.page]);

  const loadCategories = async () => {
    try {
      const categoriesData = await productService.getCategories();
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories', error);
      setCategories([]);
    }
  };

  const searchProducts = async () => {
    setLoading(true);
    logger.info(CONTEXT, `Searching for: "${debouncedQuery}"`);

    try {
      // Use fuzzy search endpoint for better results
      const searchResults = await productService.searchProducts(debouncedQuery.trim(), {
        limit: 50, // Maximum allowed by API
        threshold: 60 // Lower threshold for more flexible matching
      });
      
      let productsData = searchResults || [];
      
      // Apply category filter client-side
      if (filters.category_id) {
        const categoryId = parseInt(filters.category_id, 10);
        productsData = productsData.filter(p => p.category_id === categoryId);
      }

      // Apply sorting
      if (filters.sortBy === 'name-asc') {
        productsData.sort((a, b) => a.name.localeCompare(b.name));
      } else if (filters.sortBy === 'name-desc') {
        productsData.sort((a, b) => b.name.localeCompare(a.name));
      } else if (filters.sortBy === 'price-asc') {
        productsData.sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
      } else if (filters.sortBy === 'price-desc') {
        productsData.sort((a, b) => (b.base_price || 0) - (a.base_price || 0));
      } else if (filters.sortBy === 'featured') {
        productsData.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
      }
      // relevance is already handled by fuzzy search scoring
      
      // Client-side pagination
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedProducts = productsData.slice(startIndex, endIndex);
      
      logger.debug(CONTEXT, `Found ${productsData.length} results`, productsData);
      
      setProducts(paginatedProducts);
      setPagination(prev => ({
        ...prev,
        total: productsData.length,
        pages: Math.ceil(productsData.length / pagination.limit)
      }));
    } catch (error) {
      logger.error(CONTEXT, 'Error searching products', error);
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
    params.set('q', searchQuery); // Keep search query
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      }
    });
    
    setSearchParams(params);
  };

  const clearFilters = () => {
    const clearedFilters = {
      category_id: '',
      sortBy: 'relevance',
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    
    const params = new URLSearchParams();
    params.set('q', searchQuery);
    setSearchParams(params);
  };
  
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const params = new URLSearchParams();
      params.set('q', searchQuery.trim());
      
      // Keep existing filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params.set(key, value);
        }
      });
      
      setSearchParams(params);
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  const toggleFilterSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleClearSearch = () => {
    navigate('/products');
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
  const hasActiveFilters = filters.category_id || filters.sortBy !== 'relevance';

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
          {' '}/{' '}
          <span className="text-slate-800">Search Results</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">
            Search Results
          </h1>
          <p className="text-lg text-slate-600">
            {loading ? (
              'Searching...'
            ) : (
              <>
                Found {pagination.total} result{pagination.total !== 1 ? 's' : ''} for{' '}
                <span className="text-primary-600 font-semibold">"{searchQuery}"</span>
              </>
            )}
          </p>
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
                {/* Search Query Input */}
                <div className="pb-4 border-b border-cream-200">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2.5">
                    <SearchIcon className="w-4 h-4" />
                    Search Query
                  </label>
                  <form onSubmit={handleSearchSubmit} className="space-y-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full px-3 py-2.5 border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all"
                    />
                    <button
                      type="submit"
                      className="w-full px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Search
                    </button>
                  </form>
                  <button
                    onClick={handleClearSearch}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    Browse All Products →
                  </button>
                </div>

                {/* Sort By */}
                <div className="pb-4 border-b border-cream-200">
                  <button
                    onClick={() => toggleFilterSection('sort')}
                    className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-2.5 hover:text-primary-600 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort Results
                    </span>
                    {expandedSections.sort ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSections.sort && (
                    <select
                      value={filters.sortBy}
                      onChange={(e) => updateFilter('sortBy', e.target.value)}
                      className="w-full px-3 py-2.5 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-medium transition-all"
                    >
                      <option value="relevance">Relevance (Best Match)</option>
                      <option value="featured">Featured First</option>
                      <option value="name-asc">Name (A-Z)</option>
                      <option value="name-desc">Name (Z-A)</option>
                      <option value="price-asc">Price (Low to High)</option>
                      <option value="price-desc">Price (High to Low)</option>
                    </select>
                  )}
                </div>

                {/* Category Filter */}
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
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-1">
            {/* Results Grid */}
            {loading ? (
              <CardGridSkeleton count={9} columns={3} />
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md border border-cream-200 p-12 text-center">
                <svg
                  className="mx-auto h-24 w-24 text-slate-400 mb-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  No Results Found
                </h2>
                <p className="text-slate-600 mb-6">
                  We couldn't find any products matching "{searchQuery}"
                  {activeCategory && ` in ${activeCategory.name}`}.
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button variant="primary" onClick={handleClearSearch}>
                    Browse All Products
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/find-a-rep')}
                  >
                    Contact a Rep
                  </Button>
                </div>
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
                          return <span key={page} className="px-2 text-slate-400">...</span>;
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

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default SearchPage;
