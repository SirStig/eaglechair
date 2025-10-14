import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProductCard from '../components/ui/ProductCard';
import Button from '../components/ui/Button';
import { demoProducts } from '../data/demoData';
import logger from '../utils/logger';

const CONTEXT = 'SearchPage';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [loading, setLoading] = useState(true);

  // Get unique categories from results
  const categories = ['all', ...new Set(results.map(p => p.category))];

  // Search products
  useEffect(() => {
    setLoading(true);
    logger.info(CONTEXT, `Searching for: "${query}"`);

    if (query.trim()) {
      const searchResults = demoProducts.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase()) ||
        product.subcategory?.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase()) ||
        product.features?.some(f => f.toLowerCase().includes(query.toLowerCase()))
      );
      
      setResults(searchResults);
      logger.debug(CONTEXT, `Found ${searchResults.length} results`);
    } else {
      setResults([]);
    }
    
    setLoading(false);
  }, [query]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...results];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Sort results
    switch (sortBy) {
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
      default: // relevance
        break;
    }

    setFilteredResults(filtered);
    logger.debug(CONTEXT, `Filtered to ${filtered.length} results`);
  }, [results, selectedCategory, sortBy]);

  const handleClearSearch = () => {
    navigate('/products');
  };

  return (
    <div className="min-h-screen bg-dark-900 py-24">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Search Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-dark-50 mb-2">
              Search Results
            </h1>
            <p className="text-lg text-dark-100">
              {loading ? (
                'Searching...'
              ) : (
                <>
                  Found {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for{' '}
                  <span className="text-primary-500 font-semibold">"{query}"</span>
                </>
              )}
            </p>
          </motion.div>
        </div>

        {/* Filters and Sorting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-dark-800 rounded-lg p-6 mb-8 border border-dark-600"
        >
          <div className="flex flex-wrap gap-6">
            {/* Category Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-dark-100 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 text-dark-50 border border-dark-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-dark-100 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 text-dark-50 border border-dark-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="relevance">Relevance</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="newest">Newest First</option>
                <option value="featured">Featured</option>
              </select>
            </div>

            {/* Clear Search */}
            <div className="flex items-end">
              <Button variant="outline" onClick={handleClearSearch}>
                Clear Search
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Results Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-dark-100">Searching products...</p>
            </div>
          </div>
        ) : filteredResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResults.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <svg
              className="mx-auto h-24 w-24 text-dark-400 mb-6"
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
            <h2 className="text-2xl font-bold text-dark-50 mb-2">
              No Results Found
            </h2>
            <p className="text-dark-100 mb-6">
              We couldn't find any products matching "{query}"{' '}
              {selectedCategory !== 'all' && `in ${selectedCategory}`}.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="primary" onClick={handleClearSearch}>
                Browse All Products
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/find-a-rep'}
              >
                Contact a Rep
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;

