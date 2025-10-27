import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickViewModal from '../components/ui/QuickViewModal';
import EditableWrapper from '../components/admin/EditableWrapper';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { updateProduct, deleteProduct } from '../services/contentService';
import productService from '../services/productService';
import logger from '../utils/logger';

const CONTEXT = 'ProductCatalogPage';

const ProductCatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { category: categoryParam, subcategory: subcategoryParam } = useParams();
  
  // State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  // Filters from URL params
  const [filters, setFilters] = useState({
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    featured: searchParams.get('featured') === 'true' || false,
    new: searchParams.get('new') === 'true' || false,
    sortBy: searchParams.get('sort') || 'display_order',
  });

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Load products when filters or page changes
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.page]);

  // Update category filter when URL params change
  useEffect(() => {
    if (categoryParam) {
      // Find category by slug
      const category = categories.find(c => c.slug === categoryParam);
      if (category) {
        setFilters(prev => ({ ...prev, category_id: category.id }));
      }
    }
  }, [categoryParam, categories]);

  const loadCategories = async () => {
    try {
      const categoriesData = await productService.getCategories();
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading categories', error);
      setCategories([]);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    
    try {
      // Build params object
      const params = {
        page: pagination.page,
        per_page: pagination.limit
      };
      
      // Add filters
      if (filters.category_id) {
        params.category_id = parseInt(filters.category_id, 10);
      }
      
      if (filters.search && filters.search.trim() !== '') {
        params.search = filters.search.trim();
      }
      
      if (filters.featured) {
        params.featured = true;
      }
      
      if (filters.new) {
        params.new = true;
      }
      
      // Add sort parameter
      if (filters.sortBy) {
        params.sort = filters.sortBy;
      }
      
      // Fetch products
      const response = await productService.getProducts(params);
      
      logger.debug(CONTEXT, `Loaded ${response.total} products`, response);
      
      setProducts(response.data || []);
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
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v && v !== false && v !== '') {
        params.set(k, v);
      }
    });
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      category_id: '',
      search: '',
      featured: false,
      new: false,
      sortBy: 'display_order',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
    logger.info(CONTEXT, `Opening quick view for: ${product.name}`);
  };

  // Product CRUD handlers
  const handleUpdateProduct = async (id, updates) => {
    try {
      logger.info(CONTEXT, `Updating product ${id}`);
      await updateProduct(id, updates);
      loadProducts(); // Reload products
      logger.info(CONTEXT, 'Product updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update product', error);
      throw error;
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      logger.info(CONTEXT, `Deleting product ${id}`);
      await deleteProduct(id);
      loadProducts(); // Reload products
      logger.info(CONTEXT, 'Product deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete product', error);
      throw error;
    }
  };

  // Get active category details
  const activeCategory = categories.find(c => c.id === parseInt(filters.category_id));

  // Get subcategories for active category
  const subcategories = activeCategory?.children || [];

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

        <div className="grid lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-6 lg:gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            <div className="rounded-xl shadow-md p-4 sm:p-6 sticky top-24 bg-white/90 backdrop-blur-sm border border-cream-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Filters</h2>
                {(filters.category_id || filters.search || filters.featured || filters.new) && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary-500 hover:text-primary-400"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Category
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => updateFilter('category_id', '')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      !filters.category_id
                        ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                        : 'hover:bg-cream-100 text-slate-800'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => updateFilter('category_id', category.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        filters.category_id === category.id || filters.category_id === String(category.id)
                          ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                          : 'hover:bg-cream-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{category.name}</span>
                        {category.product_count > 0 && (
                          <span className="text-xs text-slate-500">({category.product_count})</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategories */}
              {subcategories.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Subcategory
                  </label>
                  <div className="space-y-2">
                    {subcategories.map((subcat) => (
                      <button
                        key={subcat.id}
                        onClick={() => updateFilter('category_id', subcat.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                          filters.category_id === subcat.id || filters.category_id === String(subcat.id)
                            ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                            : 'hover:bg-cream-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{subcat.name}</span>
                          {subcat.product_count > 0 && (
                            <span className="text-xs text-slate-500">({subcat.product_count})</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Filters */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quick Filters
                </label>
                <div className="space-y-2">
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
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="display_order">Default Order</option>
                  <option value="featured">Featured</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="lg:col-span-1">
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
                
                {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 xl:gap-8 mb-8">
                  {products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="h-full"
                    >
                      <EditableWrapper
                        id={`product-${product.id}`}
                        type="product"
                        data={product}
                        onSave={(newData) => handleUpdateProduct(product.id, newData)}
                        label={`Product: ${product.name}`}
                      >
                        <ProductCard 
                          product={product}
                          onQuickView={handleQuickView}
                        />
                      </EditableWrapper>
                    </motion.div>
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
                        // Show first, last, current, and adjacent pages
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

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default ProductCatalogPage;
