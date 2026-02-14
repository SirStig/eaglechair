import { api } from '../config/apiClient';
import { loadContentData } from '../utils/contentDataLoader';
import { transformProducts, transformProduct } from '../utils/apiHelpers';

const normalizeSubcategory = (s) => ({
  ...s,
  id: s.id,
  name: s.name,
  slug: s.slug,
  display_order: s.display_order ?? s.displayOrder,
  is_active: s.is_active ?? s.isActive,
});

const normalizeCategory = (c) => ({
  ...c,
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description,
  parent_id: c.parent_id ?? c.parentId,
  display_order: c.display_order ?? c.displayOrder,
  is_active: c.is_active ?? c.isActive,
  icon_url: c.icon_url ?? c.iconUrl,
  banner_image_url: c.banner_image_url ?? c.bannerImageUrl,
  subcategories: (c.subcategories || []).map(normalizeSubcategory),
});

export const productService = {
  /**
   * Get all products with optional filters
   * @param {Object} params - Query parameters (category_id, search, sort, page, limit)
   * @returns {Promise<Object>} Products and metadata
   */
  getProducts: async (params = {}) => {
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

  getRelatedProducts: async (productId, limit = 100) => {
    const response = await api.get(`/api/v1/products/${productId}/related`, { params: { limit } });
    return transformProducts(response || []);
  },

  /**
   * Get product categories (from static contentData.json when available, else API)
   * @returns {Promise<Array>} Categories with subcategories, snake_case for UI
   */
  getCategories: async () => {
    const CACHE_TTL = 30 * 60 * 1000;
    const now = Date.now();
    if (productService._categoriesCache &&
      productService._categoriesCacheTime &&
      (now - productService._categoriesCacheTime < CACHE_TTL)) {
      return productService._categoriesCache;
    }

    try {
      const content = await loadContentData();
      if (content?.categories && Array.isArray(content.categories) && content.categories.length > 0) {
        const categories = content.categories.map(normalizeCategory);
        productService._categoriesCache = categories;
        productService._categoriesCacheTime = now;
        return categories;
      }
    } catch (_) {}

    const response = await api.get('/api/v1/categories');
    const categories = Array.isArray(response) ? response : [];
    productService._categoriesCache = categories;
    productService._categoriesCacheTime = now;
    return categories;
  },

  /**
   * Get product families
   * @param {Object} params - Query parameters (category_id, featured_only)
   * @returns {Promise<Array>} Product families with counts
   */
  getFamilies: async (params = {}) => {
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
    // Determine if ID is numeric or a slug
    const isNumericId = !isNaN(parseInt(id)) && parseInt(id).toString() === id.toString();

    const endpoint = isNumericId
      ? `/api/v1/families/${id}`
      : `/api/v1/families/slug/${id}`;

    const response = await api.get(endpoint);
    return response;
  },

  /**
   * Get product subcategories (from static contentData when available, else API)
   * @param {Object} params - Query parameters (category_id)
   * @returns {Promise<Array>} Subcategories, snake_case for UI
   */
  getSubcategories: async (params = {}) => {
    const categoryId = params?.category_id != null ? parseInt(params.category_id, 10) : null;
    if (categoryId != null && productService._categoriesCache?.length) {
      const cached = productService._categoriesCache.find((c) => c.id === categoryId);
      if (cached?.subcategories && Array.isArray(cached.subcategories)) {
        return cached.subcategories;
      }
    }
    if (categoryId != null) {
      try {
        const content = await loadContentData();
        if (content?.categories && Array.isArray(content.categories)) {
          const category = content.categories.find((c) => c.id === categoryId);
          if (category?.subcategories && Array.isArray(category.subcategories)) {
            return category.subcategories.map(normalizeSubcategory);
          }
        }
      } catch (_) {}
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
    const response = await api.get('/api/v1/finishes', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get available upholsteries
   * @param {Object} params - Query parameters (material_type)
   * @returns {Promise<Array>} Upholsteries
   */
  getUpholsteries: async (params = {}) => {
    const response = await api.get('/api/v1/upholsteries', { params });
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get available colors
   * @param {Object} params - Query parameters (category: wood/metal/fabric/paint)
   * @returns {Promise<Array>} Colors
   */
  getColors: async (params = {}) => {
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
    // Backend returns PaginatedResponse, need to map per_page
    const response = await api.get('/api/v1/products', {
      params: { featured: true, per_page: limit }
    });

    // Extract items from paginated response
    const products = response.items || [];
    return transformProducts(products);
  },

  /**
   * Get product variations
   * @param {number|string} productId - Product ID
   * @returns {Promise<Object>} Product variations
   */
  getProductVariations: async (productId) => {
    const response = await api.get(`/api/v1/products/${productId}/variations`);
    return response.variations || [];
  },
};

export default productService;

