/**
 * Utility functions for handling backend API data
 * 
 * These utilities help convert between backend format (cents, timestamps, etc.)
 * and frontend display format (dollars, formatted dates, etc.)
 */

// ============================================================================
// Price Utilities
// ============================================================================

/**
 * Convert price from cents (backend) to dollars (frontend display)
 * @param {number} cents - Price in cents
 * @returns {number} Price in dollars
 */
export const centsToPrice = (cents) => {
  if (typeof cents !== 'number') return 0;
  return cents / 100;
};

/**
 * Convert price from dollars to cents (for backend)
 * @param {number} price - Price in dollars
 * @returns {number} Price in cents
 */
export const priceToCents = (price) => {
  if (typeof price !== 'number') return 0;
  return Math.round(price * 100);
};

/**
 * Format price in cents as currency string
 * @param {number} cents - Price in cents
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted price string (e.g., "$89.99")
 */
export const formatPrice = (cents, currency = 'USD') => {
  const dollars = centsToPrice(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(dollars);
};

/**
 * Get price range string
 * @param {number} minCents - Minimum price in cents
 * @param {number} maxCents - Maximum price in cents
 * @returns {string} Formatted price range (e.g., "$89.99 - $129.99")
 */
export const formatPriceRange = (minCents, maxCents) => {
  if (!maxCents || minCents === maxCents) {
    return formatPrice(minCents);
  }
  return `${formatPrice(minCents)} - ${formatPrice(maxCents)}`;
};

// ============================================================================
// Image Utilities
// ============================================================================

/**
 * Resolve image URL from various formats
 * @param {string|object} imageData - Image URL string or object with url property
 * @returns {string} Resolved image URL
 */
export const resolveImageUrl = (imageData) => {
  // Handle null/undefined
  if (!imageData) return '/placeholder.png';
  
  // Handle object format {url: "...", type: "...", ...}
  if (typeof imageData === 'object' && imageData.url) {
    const url = imageData.url;
    // External URL (starts with http/https)
    if (url.startsWith('http')) return url;
    // Already has /uploads prefix
    if (url.startsWith('/uploads')) return url;
    // Relative path - add /uploads prefix
    return `/uploads/${url}`;
  }
  
  // Handle string URL
  if (typeof imageData === 'string') {
    // External URL (starts with http/https)
    if (imageData.startsWith('http')) return imageData;
    
    // Already has /uploads prefix
    if (imageData.startsWith('/uploads')) return imageData;
    
    // Relative path - add /uploads prefix
    return `/uploads/${imageData}`;
  }
  
  return '/placeholder.png';
};

/**
 * Get product image with fallback
 * @param {object} product - Product object from API
 * @param {number} index - Image index (default: 0 for primary)
 * @returns {string} Image URL
 */
export const getProductImage = (product, index = 0) => {
  // Try images array first
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const image = product.images[index] || product.images[0];
    return resolveImageUrl(image);
  }
  
  // Fallback to primary_image
  if (product.primary_image) {
    return resolveImageUrl(product.primary_image);
  }
  
  // Legacy field support
  if (product.image) {
    return resolveImageUrl(product.image);
  }
  
  return '/placeholder.png';
};

/**
 * Get all product images as array of URLs
 * @param {object} product - Product object from API
 * @returns {string[]} Array of image URLs
 */
export const getProductImages = (product) => {
  if (product.images && Array.isArray(product.images)) {
    return product.images.map(img => resolveImageUrl(img));
  }
  
  // Fallback to single primary image
  if (product.primary_image) {
    return [resolveImageUrl(product.primary_image)];
  }
  
  // Legacy support
  if (product.image) {
    return [resolveImageUrl(product.image)];
  }
  
  return ['/placeholder.png'];
};

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Format ISO datetime string to local date
 * @param {string} isoString - ISO datetime string from backend
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (isoString, options = {}) => {
  if (!isoString) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
};

/**
 * Format ISO datetime string to relative time (e.g., "2 days ago")
 * @param {string} isoString - ISO datetime string from backend
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  
  return formatDate(isoString);
};

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Transform backend product to frontend format with legacy support
 * @param {object} product - Product from backend API
 * @returns {object} Product with both new and legacy fields
 */
export const transformProduct = (product) => {
  // Handle category field - can be object or string
  const categoryName = typeof product.category === 'object' ? product.category?.name : product.category;
  const categoryId = typeof product.category === 'object' ? product.category?.id : product.category_id;
  const categorySlug = typeof product.category === 'object' ? product.category?.slug : null;
  const parentCategorySlug = typeof product.category === 'object' ? product.category?.parent_slug : null;
  
  return {
    ...product,
    // Add legacy fields for backward compatibility
    price: centsToPrice(product.base_price),
    priceRange: product.msrp ? {
      min: centsToPrice(product.base_price),
      max: centsToPrice(product.msrp),
    } : undefined,
    image: getProductImage(product),
    featured: product.is_featured,
    // Ensure category_id is accessible even if category is an object
    category_id: categoryId,
    // Add categoryName for easy access
    categoryName: categoryName,
    categorySlug: categorySlug,
    parentCategorySlug: parentCategorySlug,
  };
};

/**
 * Transform array of backend products
 * @param {object[]} products - Array of products from backend
 * @returns {object[]} Transformed products
 */
export const transformProducts = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProduct);
};

/**
 * Transform backend category to frontend format
 * @param {object} category - Category from backend API
 * @returns {object} Category with legacy fields
 */
export const transformCategory = (category) => {
  return {
    ...category,
    // Add legacy field
    image: category.icon_url || category.banner_image_url,
  };
};

/**
 * Transform paginated response
 * @param {object} response - Paginated response from backend
 * @param {function} itemTransformer - Optional transformer for items
 * @returns {object} Transformed paginated response
 */
export const transformPaginatedResponse = (response, itemTransformer = null) => {
  if (!response) return { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 };
  
  return {
    ...response,
    items: itemTransformer ? response.items.map(itemTransformer) : response.items,
  };
};

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Build product URL with category path
 * @param {object} product - Product object with category info
 * @returns {string} Product URL path
 */
export const buildProductUrl = (product) => {
  if (!product) return '/products';
  
  // If we have category slug information, build hierarchical URL
  const categoryObj = typeof product.category === 'object' ? product.category : null;
  
  if (categoryObj) {
    // Check if category has a parent (is subcategory)
    if (categoryObj.parent_id && categoryObj.parent_slug) {
      // /products/parent-category/subcategory/product-slug
      return `/products/${categoryObj.parent_slug}/${categoryObj.slug}/${product.slug || product.id}`;
    } else if (categoryObj.slug) {
      // Top-level category: /products/category/product-slug
      return `/products/${categoryObj.slug}/uncategorized/${product.slug || product.id}`;
    }
  }
  
  // Fallback to simple URL with slugs from transformed product
  if (product.parentCategorySlug && product.categorySlug) {
    return `/products/${product.parentCategorySlug}/${product.categorySlug}/${product.slug || product.id}`;
  }
  
  // Final fallback: direct product URL
  return `/products/${product.slug || product.id}`;
};

/**
 * Check if product has valid price
 * @param {object} product - Product object
 * @returns {boolean} True if product has valid price
 */
export const hasValidPrice = (product) => {
  return product && typeof product.base_price === 'number' && product.base_price > 0;
};

/**
 * Check if product is in stock
 * @param {object} product - Product object
 * @returns {boolean} True if product is in stock
 */
export const isInStock = (product) => {
  if (!product) return false;
  const status = product.stock_status?.toLowerCase() || '';
  return status === 'in stock' || status === 'available';
};

/**
 * Check if product is custom/made-to-order
 * @param {object} product - Product object
 * @returns {boolean} True if product is custom
 */
export const isCustomProduct = (product) => {
  return product?.is_custom_only === true || 
         product?.stock_status?.toLowerCase().includes('made to order');
};

// ============================================================================
// Export all utilities
// ============================================================================

export default {
  // Price
  centsToPrice,
  priceToCents,
  formatPrice,
  formatPriceRange,
  
  // Images
  resolveImageUrl,
  getProductImage,
  getProductImages,
  
  // Dates
  formatDate,
  formatRelativeTime,
  
  // Transformation
  transformProduct,
  transformProducts,
  transformCategory,
  transformPaginatedResponse,
  
  // URL building
  buildProductUrl,
  
  // Validation
  hasValidPrice,
  isInStock,
  isCustomProduct,
};
