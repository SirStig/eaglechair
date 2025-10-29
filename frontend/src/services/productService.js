import { api, IS_DEMO_MODE } from '../config/apiClient';
import { demoProducts, demoCategories } from '../data/demoData';
import { transformProducts, transformProduct } from '../utils/apiHelpers';

/**
 * Product Service
 * Handles all product-related API calls
 * Automatically switches between demo data and real API based on IS_DEMO_MODE
 */

export const productService = {
  /**
   * Get all products with optional filters
   * @param {Object} params - Query parameters (category_id, search, sort, page, limit)
   * @returns {Promise<Object>} Products and metadata
   */
  getProducts: async (params = {}) => {
    if (IS_DEMO_MODE) {
      // Demo mode - return filtered demo data
      let products = [...demoProducts];
      
      // Apply filters (handle both old 'category' and new 'category_id' params)
      const categoryFilter = params.category_id || params.category;
      if (categoryFilter) {
        products = products.filter(p => {
          // Support both category_id (new) and category (legacy)
          if (typeof categoryFilter === 'number') {
            return p.category_id === categoryFilter;
          } else {
            return p.category?.toLowerCase() === categoryFilter.toLowerCase();
          }
        });
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
          p.model_number?.toLowerCase().includes(searchLower) ||
          p.short_description?.toLowerCase().includes(searchLower) ||
          p.full_description?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by is_active
      if (params.is_active !== undefined) {
        products = products.filter(p => p.is_active === params.is_active);
      }

      // Filter by is_featured
      if (params.is_featured) {
        products = products.filter(p => p.is_featured);
      }
      
      // Apply sorting
      switch (params.sort) {
        case 'name-asc':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          products.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'price-asc':
          products.sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
          break;
        case 'price-desc':
          products.sort((a, b) => (b.base_price || 0) - (a.base_price || 0));
          break;
        case 'featured':
          products.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
          break;
        case 'display_order':
          products.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
          break;
        default:
          // Default sort by display_order then by name
          products.sort((a, b) => {
            const orderDiff = (a.display_order || 999) - (b.display_order || 999);
            return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
          });
      }

      // Apply pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = products.slice(startIndex, endIndex);
      
      return {
        data: transformProducts(paginatedProducts), // Transform to include legacy fields
        total: products.length,
        page,
        limit,
        pages: Math.ceil(products.length / limit),
      };
    }
    
    // Real API mode
    // Backend uses 'per_page' instead of 'limit', handle sorting client-side
    const { sort, limit, ...apiParams } = params;
    
    // Map limit to per_page for backend
    if (limit) {
      apiParams.per_page = limit;
    }
    
    const response = await api.get('/api/v1/products', { params: apiParams });
    
    // Backend returns PaginatedResponse[ChairResponse]:
    // { items: [...], total: int, page: int, per_page: int, total_pages: int, has_next: bool, has_prev: bool }
    let products = response.items || [];
    
    // Apply client-side sorting if sort param was provided
    if (sort) {
      switch (sort) {
        case 'name-asc':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          products.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'price-asc':
          products.sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
          break;
        case 'price-desc':
          products.sort((a, b) => (b.base_price || 0) - (a.base_price || 0));
          break;
        case 'featured':
          products.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
          break;
        case 'display_order':
          products.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
          break;
        default:
          // Default sort already applied by backend
          break;
      }
    }
    
    // Transform products to include legacy fields for backward compatibility
    // Return in expected format: { data: [...], total, page, limit/per_page, pages/total_pages }
    return {
      data: transformProducts(products),
      total: response.total || 0,
      page: response.page || 1,
      limit: response.per_page || params.per_page || 20,
      pages: response.total_pages || 0,
      has_next: response.has_next || false,
      has_prev: response.has_prev || false,
    };
  },

  /**
   * Get single product by ID or slug
   * @param {string|number} id - Product ID or slug
   * @returns {Promise<Object>} Product details
   */
  getProductById: async (id) => {
    if (IS_DEMO_MODE) {
      const product = demoProducts.find(p => p.id === parseInt(id) || p.slug === id);
      if (!product) {
        throw { message: 'Product not found', status: 404 };
      }
      
      // Get related products (same category, different product)
      const related = demoProducts
        .filter(p => p.category_id === product.category_id && p.id !== product.id && p.is_active)
        .slice(0, 4);
      
      return { 
        data: transformProduct(product),
        related: transformProducts(related)
      };
    }
    
    // Determine if ID is numeric or a slug
    const isNumericId = !isNaN(parseInt(id)) && parseInt(id).toString() === id.toString();
    
    // Use appropriate endpoint
    const endpoint = isNumericId 
      ? `/api/v1/products/${id}` 
      : `/api/v1/products/slug/${id}`;
    
    const response = await api.get(endpoint);
    
    // Backend returns ChairDetailResponse directly (not wrapped)
    // ChairDetailResponse includes: product data + category + related_products
    const productData = response;
    
    return {
      data: transformProduct(productData),
      related: productData.related_products ? transformProducts(productData.related_products) : []
    };
  },

  /**
   * Get product categories
   * @returns {Promise<Array>} Categories
   */
  getCategories: async () => {
    if (IS_DEMO_MODE) {
      return demoCategories;
    }
    
    // Backend returns list[CategoryResponse] directly (not paginated)
    const response = await api.get('/api/v1/categories');
    
    // Response is an array of categories
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get product families
   * @param {Object} params - Query parameters (category_id, featured_only)
   * @returns {Promise<Array>} Product families with counts
   */
  getFamilies: async (params = {}) => {
    if (IS_DEMO_MODE) {
      // Return mock data for demo mode
      return [];
    }
    
    // Backend returns list[ProductFamilyResponse] with product_count
    const response = await api.get('/api/v1/families', { params });
    
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get family by ID or slug
   * @param {string|number} id - Family ID or slug
   * @returns {Promise<Object>} Family details with product count
   */
  getFamilyById: async (id) => {
    if (IS_DEMO_MODE) {
      throw { message: 'Family not found', status: 404 };
    }
    
    // Determine if ID is numeric or a slug
    const isNumericId = !isNaN(parseInt(id)) && parseInt(id).toString() === id.toString();
    
    const endpoint = isNumericId 
      ? `/api/v1/families/${id}` 
      : `/api/v1/families/slug/${id}`;
    
    const response = await api.get(endpoint);
    return response;
  },

  /**
   * Get product subcategories
   * @param {Object} params - Query parameters (category_id)
   * @returns {Promise<Array>} Subcategories with counts
   */
  getSubcategories: async (params = {}) => {
    if (IS_DEMO_MODE) {
      return [];
    }
    
    const response = await api.get('/api/v1/subcategories', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get available finishes
   * @param {Object} params - Query parameters (finish_type)
   * @returns {Promise<Array>} Finishes
   */
  getFinishes: async (params = {}) => {
    if (IS_DEMO_MODE) {
      return [];
    }
    
    const response = await api.get('/api/v1/finishes', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get available upholsteries
   * @param {Object} params - Query parameters (material_type)
   * @returns {Promise<Array>} Upholsteries
   */
  getUpholsteries: async (params = {}) => {
    if (IS_DEMO_MODE) {
      return [];
    }
    
    const response = await api.get('/api/v1/upholsteries', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get available colors
   * @param {Object} params - Query parameters (category: wood/metal/fabric/paint)
   * @returns {Promise<Array>} Colors
   */
  getColors: async (params = {}) => {
    if (IS_DEMO_MODE) {
      return [];
    }
    
    const response = await api.get('/api/v1/colors', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Search products with fuzzy matching
   * @param {string} query - Search query
   * @param {Object} options - Search options (limit, threshold)
   * @returns {Promise<Array>} Matching products
   */
  searchProducts: async (query, options = {}) => {
    if (IS_DEMO_MODE) {
      const searchLower = query.toLowerCase();
      const results = demoProducts.filter(p =>
        p.is_active && (
          p.name.toLowerCase().includes(searchLower) ||
          p.short_description?.toLowerCase().includes(searchLower) ||
          p.full_description?.toLowerCase().includes(searchLower) ||
          p.model_number?.toLowerCase().includes(searchLower)
        )
      );
      return transformProducts(results);
    }
    
    // Use fuzzy search endpoint with threshold
    const params = { 
      q: query,
      limit: options.limit || 10,
      threshold: options.threshold || 75
    };
    
    const response = await api.get('/api/v1/products/search', { params });
    
    // Response is an array of products
    return transformProducts(Array.isArray(response) ? response : []);
  },

  /**
   * Get featured products
   * @param {number} limit - Maximum number of products to return
   * @returns {Promise<Array>} Featured products
   */
  getFeaturedProducts: async (limit = 6) => {
    if (IS_DEMO_MODE) {
      const featured = demoProducts
        .filter(p => p.is_featured && p.is_active)
        .slice(0, limit);
      return transformProducts(featured);
    }

    // Backend returns PaginatedResponse, need to map per_page
    const response = await api.get('/api/v1/products', { 
      params: { featured: true, per_page: limit } 
    });
    
    // Extract items from paginated response
    const products = response.items || [];
    return transformProducts(products);
  },
};

export default productService;

