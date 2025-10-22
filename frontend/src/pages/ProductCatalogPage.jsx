import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickViewModal from '../components/ui/QuickViewModal';
import EditableWrapper from '../components/admin/EditableWrapper';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { demoProducts, demoCategories, IS_DEMO } from '../data/demoData';
import { updateProduct, deleteProduct } from '../services/contentService';
import { useLightTheme } from '../utils/themeTransition';
import logger from '../utils/logger';

const CONTEXT = 'ProductCatalogPage';

const ProductCatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const shouldBeLightTheme = useLightTheme(location.pathname);
  const [isLightTheme, setIsLightTheme] = useState(false);
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    subcategory: searchParams.get('subcategory') || '',
    search: searchParams.get('search') || '',
    finish: searchParams.get('finish') || '',
    material: searchParams.get('material') || '',
    sortBy: searchParams.get('sort') || 'featured',
  });

  // Extract unique finishes and materials from products
  const availableFinishes = [...new Set(demoProducts.flatMap(p => 
    p.customizations?.finishes || p.customizations?.colors || []
  ))].filter(Boolean);

  const availableMaterials = [...new Set(demoProducts.flatMap(p => 
    p.specs?.Material ? [p.specs.Material] : []
  ))].filter(Boolean);

  // Load data first
  useEffect(() => {
    loadData();
  }, [filters]);

  // Theme transition effect - wait for data load AND animations to complete
  useEffect(() => {
    if (shouldBeLightTheme && !loading) {
      // Calculate animation duration: products.length * 50ms delay + 300ms animation duration + 200ms buffer
      const animationDuration = (products.length * 50) + 500;
      console.log(`Waiting ${animationDuration}ms for animations to complete before transitioning`);
      
      const timer = setTimeout(() => {
        console.log('Activating light theme transition');
        setIsLightTheme(true);
      }, animationDuration);
      return () => clearTimeout(timer);
    } else if (!shouldBeLightTheme) {
      console.log('Deactivating light theme');
      setIsLightTheme(false);
    }
  }, [shouldBeLightTheme, loading, products.length]);

  const loadData = async () => {
    setLoading(true);
    
    if (IS_DEMO) {
      // Demo mode - filter products locally
      let filtered = [...demoProducts];
      
      if (filters.category) {
        filtered = filtered.filter(p => 
          p.category.toLowerCase() === filters.category.toLowerCase()
        );
      }
      
      if (filters.subcategory) {
        filtered = filtered.filter(p => 
          p.subcategory?.toLowerCase() === filters.subcategory.toLowerCase()
        );
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      if (filters.finish) {
        filtered = filtered.filter(p => 
          p.customizations?.finishes?.includes(filters.finish) ||
          p.customizations?.colors?.includes(filters.finish)
        );
      }

      if (filters.material) {
        filtered = filtered.filter(p => 
          p.specs?.Material === filters.material
        );
      }
      
      // Sort
      switch (filters.sortBy) {
        case 'name-asc':
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          filtered.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'newest':
          filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
          break;
        case 'featured':
          filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
          break;
        default:
          break;
      }
      
      logger.debug(CONTEXT, `Filtered ${filtered.length} products`, filters);
      
      setProducts(filtered);
      setCategories(demoCategories);
      setLoading(false);
    } else {
      // Real API mode
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetch(`/api/v1/products?${queryParams}`);
        const data = await response.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      subcategory: '',
      search: '',
      finish: '',
      material: '',
      sortBy: 'featured',
    });
    setSearchParams({});
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
      loadData(); // Reload products
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
      loadData(); // Reload products
      logger.info(CONTEXT, 'Product deleted successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to delete product', error);
      throw error;
    }
  };

  const activeCategory = categories.find(c => 
    c.slug === filters.category || c.name.toLowerCase() === filters.category.toLowerCase()
  );

  return (
    <div className={`min-h-screen py-8 transition-colors duration-[1500ms] ${
      isLightTheme 
        ? 'bg-gradient-to-br from-cream-50 to-cream-100' 
        : 'bg-dark-800'
    }`}>
      <div className="container mx-auto px-4 max-w-[1600px]">
        {/* Breadcrumb */}
        <div className={`mb-6 text-sm ${isLightTheme ? 'text-slate-600' : 'text-dark-100'}`}>
          <span className="cursor-pointer hover:text-primary-500" onClick={() => navigate('/')}>
            Home
          </span>
          {' '}/{' '}
          <span className="cursor-pointer hover:text-primary-500" onClick={() => navigate('/products')}>
            Products
          </span>
          {filters.category && (
            <>
              {' '}/{' '}
              <span className={isLightTheme ? 'text-slate-800' : 'text-dark-50'}>{filters.category}</span>
            </>
          )}
          {filters.subcategory && (
            <>
              {' '}/{' '}
              <span className={isLightTheme ? 'text-slate-800' : 'text-dark-50'}>{filters.subcategory}</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${isLightTheme ? 'text-slate-800' : 'text-dark-50'}`}>
            {filters.category ? `${filters.category}` : 'All Products'}
          </h1>
          {activeCategory && (
            <p className={`text-lg ${isLightTheme ? 'text-slate-600' : 'text-dark-100'}`}>{activeCategory.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            <div className={`rounded-xl shadow-md p-6 sticky top-24 ${
              isLightTheme 
                ? 'bg-white/90 backdrop-blur-sm border border-cream-200' 
                : 'bg-dark-600 border border-dark-500'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-semibold ${isLightTheme ? 'text-slate-800' : 'text-dark-50'}`}>Filters</h2>
                {(filters.category || filters.subcategory || filters.search || filters.finish || filters.material) && (
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
                <label className={`block text-sm font-medium mb-2 ${isLightTheme ? 'text-slate-700' : 'text-dark-100'}`}>
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search products..."
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    isLightTheme 
                      ? 'border-cream-300 bg-white text-slate-800 placeholder-slate-400' 
                      : 'border-dark-400 bg-dark-700 text-dark-50 placeholder-dark-200'
                  }`}
                />
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${isLightTheme ? 'text-slate-700' : 'text-dark-100'}`}>
                  Category
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => updateFilter('category', '')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      !filters.category
                        ? 'bg-primary-900 text-primary-300 font-medium border border-primary-500'
                        : 'hover:bg-dark-700 text-dark-100'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        updateFilter('category', category.slug);
                        updateFilter('subcategory', '');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        filters.category === category.slug
                          ? 'bg-primary-900 text-primary-300 font-medium border border-primary-500'
                          : 'hover:bg-dark-700 text-dark-100'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategories */}
              {activeCategory && activeCategory.subcategories && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Type
                  </label>
                  <div className="space-y-2">
                    {activeCategory.subcategories.map((subcat) => (
                      <button
                        key={subcat}
                        onClick={() => updateFilter('subcategory', subcat)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                          filters.subcategory === subcat
                            ? 'bg-primary-900 text-primary-300 font-medium border border-primary-500'
                            : 'hover:bg-dark-700 text-dark-100'
                        }`}
                      >
                        {subcat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Finishes/Colors */}
              {availableFinishes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Finish/Color
                  </label>
                  <select
                    value={filters.finish}
                    onChange={(e) => updateFilter('finish', e.target.value)}
                    className="w-full px-3 py-2 border border-dark-400 bg-dark-700 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Finishes</option>
                    {availableFinishes.map((finish) => (
                      <option key={finish} value={finish}>
                        {finish}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Materials */}
              {availableMaterials.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Material
                  </label>
                  <select
                    value={filters.material}
                    onChange={(e) => updateFilter('material', e.target.value)}
                    className="w-full px-3 py-2 border border-dark-400 bg-dark-700 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Materials</option>
                    {availableMaterials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-dark-400 bg-dark-700 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="lg:col-span-3">
            {loading ? (
              <CardGridSkeleton count={9} columns={3} />
            ) : products.length === 0 ? (
              <div className="bg-dark-800 rounded-xl shadow-md p-12 text-center">
                <svg className="mx-auto h-24 w-24 text-dark-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold mb-2 text-dark-50">No products found</h3>
                <p className="text-dark-300 mb-4">
                  Try adjusting your filters or search terms
                </p>
                <Button onClick={clearFilters} variant="primary">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {products.length} product{products.length !== 1 ? 's' : ''}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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


