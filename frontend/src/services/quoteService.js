import { api } from '../config/apiClient';
import { formatPrice, priceToCents, centsToPrice } from '../utils/apiHelpers';

/**
 * Quote Service
 * Handles quote request and management API calls
 * 
 * NOTE: Backend stores all prices in CENTS (integer), not dollars (float)
 * - Use priceToCents() when sending prices to backend
 * - Use centsToPrice() when displaying prices from backend
 * - Use formatPrice() for formatted currency display
 */

export const quoteService = {
  /**
   * Submit quote request
   * @param {FormData|Object} quoteData - Quote data (FormData for file uploads, or Object)
   * @returns {Promise<Object>} Created quote
   */
  createQuote: async (quoteData) => {
    // If it's FormData, use upload method
    if (quoteData instanceof FormData) {
      return await api.upload('/api/v1/quotes', quoteData);
    }
    
    // Otherwise, use regular POST with JSON
    // Convert any dollar amounts to cents before sending
    const payload = {
      ...quoteData,
      items: quoteData.items?.map(item => ({
        ...item,
        // If price_per_unit is provided in dollars, convert to cents
        price_per_unit: item.price_per_unit_cents || priceToCents(item.price_per_unit || 0),
        // Remove dollar fields
        price_per_unit_cents: item.price_per_unit_cents || priceToCents(item.price_per_unit || 0),
      }))
    };
    
    return await api.post('/api/v1/quotes', payload);
  },

  /**
   * Get all quotes for current user
   * @param {Object} params - Query parameters (status, page, limit)
   * @returns {Promise<Object>} Quotes with pagination
   */
  getQuotes: async (params = {}) => {
    const response = await api.get('/api/v1/quotes', { params });
    return response;
  },

  /**
   * Get single quote by ID
   * @param {string|number} id - Quote ID
   * @returns {Promise<Object>} Quote details with items
   */
  getQuoteById: async (id) => {
    const response = await api.get(`/api/v1/quotes/${id}`);
    return response;
  },

  /**
   * Update quote status (admin only)
   * @param {string|number} id - Quote ID
   * @param {string} status - New status (pending|approved|rejected|completed)
   * @returns {Promise<Object>} Updated quote
   */
  updateQuoteStatus: async (id, status) => {
    return await api.patch(`/api/v1/quotes/${id}/status`, { status });
  },

  /**
   * Add item to quote cart (before submission)
   * @param {Object} item - Quote item data
   * @returns {Object} Item with calculated totals
   */
  calculateQuoteItem: (item) => {
    const pricePerUnit = item.price_per_unit_cents || priceToCents(item.price_per_unit || 0);
    const quantity = item.quantity || 1;
    const subtotal = pricePerUnit * quantity;
    
    return {
      ...item,
      price_per_unit_cents: pricePerUnit,
      quantity,
      subtotal_cents: subtotal,
      // Legacy fields for backward compatibility
      price_per_unit: centsToPrice(pricePerUnit),
      subtotal: centsToPrice(subtotal),
    };
  },

  /**
   * Calculate quote totals
   * @param {Array} items - Array of quote items
   * @param {number} taxRate - Tax rate (default 0)
   * @returns {Object} Totals in cents
   */
  calculateQuoteTotals: (items, taxRate = 0) => {
    const subtotal_cents = items.reduce((sum, item) => {
      return sum + (item.subtotal_cents || 0);
    }, 0);
    
    const tax_cents = Math.round(subtotal_cents * taxRate);
    const total_cents = subtotal_cents + tax_cents;
    
    return {
      subtotal_cents,
      tax_cents,
      total_cents,
      // Legacy fields for display
      subtotal: centsToPrice(subtotal_cents),
      tax: centsToPrice(tax_cents),
      total: centsToPrice(total_cents),
      subtotal_formatted: formatPrice(subtotal_cents),
      tax_formatted: formatPrice(tax_cents),
      total_formatted: formatPrice(total_cents),
    };
  },
};

export default quoteService;

