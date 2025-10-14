import { api, IS_DEMO_MODE } from '../config/apiClient';
import { demoProducts, demoCategories } from '../data/demoData';

/**
 * Product Service
 * Handles all product-related API calls
 * Automatically switches between demo data and real API based on IS_DEMO_MODE
 */

export const productService = {
  /**
   * Get all products with optional filters
   * @param {Object} params - Query parameters (category, search, sort, page, limit)
   * @returns {Promise<Object>} Products and metadata
   */
  getProducts: async (params = {}) => {
    if (IS_DEMO_MODE) {
      // Demo mode - return filtered demo data
      let products = [...demoProducts];
      
      // Apply filters
      if (params.category) {
        products = products.filter(p => 
          p.category.toLowerCase() === params.category.toLowerCase()
        );
      }
      
      if (params.subcategory) {
        products = products.filter(p => 
          p.subcategory?.toLowerCase() === params.subcategory.toLowerCase()
        );
      }
      
      if (params.search) {
        const searchLower = params.search.toLowerCase();
        products = products.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      switch (params.sort) {
        case 'name-asc':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          products.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'featured':
          products.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
          break;
      }
      
      return {
        products,
        total: products.length,
        page: params.page || 1,
        limit: params.limit || 20,
      };
    }
    
    // Real API mode
    return await api.get('/api/v1/products', { params });
  },

  /**
   * Get single product by ID
   * @param {string|number} id - Product ID
   * @returns {Promise<Object>} Product details
   */
  getProductById: async (id) => {
    if (IS_DEMO_MODE) {
      const product = demoProducts.find(p => p.id === parseInt(id) || p.slug === id);
      if (!product) {
        throw { message: 'Product not found', status: 404 };
      }
      
      // Get related products
      const related = demoProducts
        .filter(p => p.category === product.category && p.id !== product.id)
        .slice(0, 4);
      
      return { product, related };
    }
    
    return await api.get(`/api/v1/products/${id}`);
  },

  /**
   * Get product categories
   * @returns {Promise<Array>} Categories
   */
  getCategories: async () => {
    if (IS_DEMO_MODE) {
      return demoCategories;
    }
    
    return await api.get('/api/v1/categories');
  },

  /**
   * Search products
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching products
   */
  searchProducts: async (query) => {
    if (IS_DEMO_MODE) {
      const searchLower = query.toLowerCase();
      return demoProducts.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower)
      );
    }
    
    return await api.get('/api/v1/products/search', { params: { q: query } });
  },
};

export default productService;

