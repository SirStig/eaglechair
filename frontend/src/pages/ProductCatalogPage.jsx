import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import QuickViewModal from '../components/ui/QuickViewModal';
import EditableWrapper from '../components/admin/EditableWrapper';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { demoProducts, demoCategories, IS_DEMO } from '../data/demoData';
import { updateProduct, deleteProduct } from '../services/contentService';
import logger from '../utils/logger';

const CONTEXT = 'ProductCatalogPage';

const ProductCatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
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

  // Load data when filters change
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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
          {filters.category && (
            <>
              {' '}/{' '}
              <span className="text-slate-800">{filters.category}</span>
            </>
          )}
          {filters.subcategory && (
            <>
              {' '}/{' '}
              <span className="text-slate-800">{filters.subcategory}</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">
            {filters.category ? `${filters.category}` : 'All Products'}
          </h1>
          {activeCategory && (
            <p className="text-lg text-slate-600">{activeCategory.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-6 lg:gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            <div className="rounded-xl shadow-md p-4 sm:p-6 sticky top-24 bg-white/90 backdrop-blur-sm border border-cream-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Filters</h2>
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
                    onClick={() => updateFilter('category', '')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      !filters.category
                        ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                        : 'hover:bg-cream-100 text-slate-800'
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
                          ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                          : 'hover:bg-cream-100 text-slate-800'
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type
                  </label>
                  <div className="space-y-2">
                    {activeCategory.subcategories.map((subcat) => (
                      <button
                        key={subcat}
                        onClick={() => updateFilter('subcategory', subcat)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                          filters.subcategory === subcat
                            ? 'bg-primary-50 text-primary-900 font-medium border border-primary-500'
                            : 'hover:bg-cream-100 text-slate-800'
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Finish/Color
                  </label>
                  <select
                    value={filters.finish}
                    onChange={(e) => updateFilter('finish', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Material
                  </label>
                  <select
                    value={filters.material}
                    onChange={(e) => updateFilter('material', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                <div className="mb-4 text-sm text-slate-600">
                  Showing {products.length} product{products.length !== 1 ? 's' : ''}
                </div>
                
                {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 xl:gap-8">
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


