import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { demoProducts, demoCategories, IS_DEMO } from '../data/demoData';

const ProductCatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    subcategory: searchParams.get('subcategory') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sort') || 'featured',
  });

  useEffect(() => {
    loadData();
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
      
      // Sort
      switch (filters.sortBy) {
        case 'name-asc':
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          filtered.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'featured':
          filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
          break;
        default:
          break;
      }
      
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
      sortBy: 'featured',
    });
    setSearchParams({});
  };

  const activeCategory = categories.find(c => 
    c.slug === filters.category || c.name.toLowerCase() === filters.category.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container mx-auto px-4 max-w-[1600px]">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-dark-100">
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
              <span className="text-dark-50">{filters.category}</span>
            </>
          )}
          {filters.subcategory && (
            <>
              {' '}/{' '}
              <span className="text-dark-50">{filters.subcategory}</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-dark-50">
            {filters.category ? `${filters.category}` : 'All Products'}
          </h1>
          {activeCategory && (
            <p className="text-lg text-dark-100">{activeCategory.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:col-span-1">
            <div className="bg-dark-600 border border-dark-500 rounded-xl shadow-md p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-dark-50">Filters</h2>
                {(filters.category || filters.subcategory || filters.search) && (
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
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-3 py-2 border border-dark-400 bg-dark-700 text-dark-50 placeholder-dark-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-100 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <div className="space-y-2">
                    {activeCategory.subcategories.map((subcat) => (
                      <button
                        key={subcat}
                        onClick={() => updateFilter('subcategory', subcat)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                          filters.subcategory === subcat
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {subcat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="featured">Featured</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="lg:col-span-3">
            {loading ? (
              <div className="flex justify-center items-center h-96">
                <LoadingSpinner size="lg" />
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <svg className="mx-auto h-24 w-24 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">
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
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductCatalogPage;


