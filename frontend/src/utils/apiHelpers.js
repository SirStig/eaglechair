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
 * Handles different formats:
 * - Object: {url: "path/to/image.jpg", type: "primary"}
 * - String: "path/to/image.jpg" or "/uploads/path/to/image.jpg"
 * - URL: "https://example.com/image.jpg"
 * 
 * Special handling for legacy wp-content URLs:
 * - wp-content URLs are redirected to www.eaglechair.com (original site)
 * - Other URLs use joshua.eaglechair.com (current site)
 * 
 * @param {string|object} imageData - Image URL string or object with url property
 * @returns {string} Resolved image URL
 */
export const resolveImageUrl = (imageData) => {
  // Handle null/undefined
  if (!imageData) return '/placeholder.png';

  // Helper function to process URL string
  const processUrl = (url) => {
    // External URL (starts with http/https)
    if (url.startsWith('http')) {
      // Check if it's a wp-content URL that needs to be fixed
      // e.g., https://joshua.eaglechair.com/uploads//wp-content/...
      if (url.includes('/wp-content/uploads/')) {
        // Extract the wp-content path and redirect to original site
        const wpContentPath = url.substring(url.indexOf('/wp-content/'));
        return `https://www.eaglechair.com${wpContentPath}`;
      }
      return url;
    }

    // Handle temporary catalog images (from virtual catalog uploads)
    // These are stored in frontend/tmp/images/ and served by frontend web server
    if (url.startsWith('/tmp/')) {
      // Images are served directly from frontend tmp directory
      // Dev: Vite dev server serves from frontend/tmp/
      // Prod: Web server (nginx/apache) serves from /home/dh_wmujeb/joshua.eaglechair.com/tmp/
      return url;  // Return as-is, frontend will serve it
    }

    // Handle wp-content paths (from seeded content)
    if (url.includes('/wp-content/uploads/') || url.includes('wp-content/uploads/')) {
      // Extract just the wp-content portion
      const wpContentPath = url.includes('/wp-content/')
        ? url.substring(url.indexOf('/wp-content/'))
        : `/wp-content/${url.substring(url.indexOf('wp-content/'))}`;
      // Point to original site for legacy WordPress content
      return `https://www.eaglechair.com${wpContentPath}`;
    }

    // Already has /uploads prefix - in dev, Vite proxy will forward to backend
    // In production, we add the full domain
    if (url.startsWith('/uploads')) {
      // In development, use as-is (Vite proxy handles it)
      if (import.meta.env.DEV) {
        return url;
      }
      // Production: add domain
      return `https://joshua.eaglechair.com${url}`;
    }

    // Relative path - add /uploads prefix
    const urlPath = url.startsWith('/') ? url : `/uploads/${url}`;

    // In development, return as-is (Vite proxy handles it)
    if (import.meta.env.DEV) {
      return urlPath;
    }

    // Production: add domain
    return `https://joshua.eaglechair.com${urlPath}`;
  };

  // Handle object format {url: "...", type: "...", ...}
  if (typeof imageData === 'object' && imageData.url) {
    return processUrl(imageData.url);
  }

  // Handle string URL
  if (typeof imageData === 'string') {
    return processUrl(imageData);
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

  // Try primary_image_url (cart/quote enriched data)
  if (product.primary_image_url) {
    return resolveImageUrl(product.primary_image_url);
  }

  // Try thumbnail
  if (product.thumbnail) {
    return resolveImageUrl(product.thumbnail);
  }

  // Try image_url (cart/quote enriched data)
  if (product.image_url) {
    return resolveImageUrl(product.image_url);
  }

  // Fallback to primary_image (legacy)
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
 * Get all product images as array of URLs (primary, hover, gallery; excludes thumbnail)
 * @param {object} product - Product object from API
 * @returns {string[]} Array of image URLs
 */
export const getProductImages = (product) => {
  const primary = product.primary_image_url || product.primary_image || product.image_url || product.image;
  const primaryUrl = primary ? resolveImageUrl(primary) : null;
  const hoverList = Array.isArray(product.hover_images) ? product.hover_images.map(img => resolveImageUrl(img)) : [];
  const galleryList = Array.isArray(product.images) ? product.images.map(img => resolveImageUrl(img)) : [];
  const combined = [primaryUrl, ...hoverList, ...galleryList].filter(Boolean);
  const seen = new Set();
  const deduped = combined.filter(url => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  if (deduped.length > 0) return deduped;
  if (product.thumbnail) return [resolveImageUrl(product.thumbnail)];
  return ['/placeholder.png'];
};

/**
 * Get product hover images for carousel (primary + hover_images array from API)
 * @param {object} product - Product object from API
 * @returns {string[]} Array of hover image URLs (primary first, then hover_images)
 */
export const getProductHoverImages = (product) => {
  const primaryImage = getProductImage(product, 0);
  if (product.hover_images && Array.isArray(product.hover_images) && product.hover_images.length > 0) {
    const hoverUrls = product.hover_images.map(img => resolveImageUrl(img));
    const unique = new Set([primaryImage, ...hoverUrls]);
    return Array.from(unique);
  }
  if (product.images && Array.isArray(product.images)) {
    const typeHover = product.images
      .filter(img => img && (img.type === 'hover' || (typeof img === 'object' && img.type === 'hover')))
      .map(img => resolveImageUrl(img));
    if (typeHover.length > 0) {
      return [primaryImage, ...typeHover];
    }
  }
  return [primaryImage];
};

/**
 * Get only gallery images (product.images), excluding primary, hover, and thumbnail.
 * @param {object} product - Product object from API
 * @returns {string[]} Array of gallery image URLs
 */
export const getProductGalleryImages = (product) => {
  if (!product?.images || !Array.isArray(product.images)) return [];
  return product.images.map(img => resolveImageUrl(img));
};

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Format file size from bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted file size (e.g., "1.5 MB", "500 KB", "2.3 GB")
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Resolve file URL from various formats (similar to resolveImageUrl)
 * Handles PDF and document files
 * @param {string} fileUrl - File URL string
 * @returns {string} Resolved file URL
 */
export const resolveFileUrl = (fileUrl) => {
  if (!fileUrl) return '';

  // Helper function to process URL string
  const processUrl = (url) => {
    // External URL (starts with http/https)
    if (url.startsWith('http')) {
      return url;
    }

    // Already has /uploads prefix - in dev, Vite proxy will forward to backend
    // In production, we add the full domain
    if (url.startsWith('/uploads')) {
      // In development, use as-is (Vite proxy handles it)
      if (import.meta.env.DEV) {
        return url;
      }
      // Production: add domain
      return `https://joshua.eaglechair.com${url}`;
    }

    // Relative path - add /uploads prefix
    const urlPath = url.startsWith('/') ? url : `/uploads/${url}`;

    // In development, return as-is (Vite proxy handles it)
    if (import.meta.env.DEV) {
      return urlPath;
    }

    // Production: add domain
    return `https://joshua.eaglechair.com${urlPath}`;
  };

  return processUrl(fileUrl);
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
  getProductHoverImages,
  getProductGalleryImages,

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
