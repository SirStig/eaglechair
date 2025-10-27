import { api, IS_DEMO_MODE } from '../config/apiClient';
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
    if (IS_DEMO_MODE) {
      // Demo mode - simulate quote creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        id: Date.now(),
        quote_number: `QT-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        status: 'pending',
        customer_name: quoteData.get ? quoteData.get('customer_name') : quoteData.customer_name,
        customer_email: quoteData.get ? quoteData.get('customer_email') : quoteData.customer_email,
        items: [],
        subtotal_cents: 0,
        tax_cents: 0,
        total_cents: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    
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
    if (IS_DEMO_MODE) {
      // Demo mode - return sample quotes with cents pricing
      const sampleQuotes = [
        {
          id: 1,
          quote_number: 'QT-2024-001',
          customer_name: 'Demo Restaurant',
          customer_email: 'demo@restaurant.com',
          status: 'pending',
          items_count: 5,
          subtotal_cents: 1250000, // $12,500.00
          tax_cents: 0,
          total_cents: 1250000,
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z',
        },
        {
          id: 2,
          quote_number: 'QT-2024-002',
          customer_name: 'Demo Hotel',
          customer_email: 'demo@hotel.com',
          status: 'approved',
          items_count: 8,
          subtotal_cents: 1875000, // $18,750.00
          tax_cents: 0,
          total_cents: 1875000,
          created_at: '2024-01-10T14:20:00Z',
          updated_at: '2024-01-12T09:15:00Z',
        },
      ];
      
      // Filter by status if provided
      let filtered = sampleQuotes;
      if (params.status) {
        filtered = filtered.filter(q => q.status === params.status);
      }
      
      return {
        data: filtered,
        total: filtered.length,
        page: params.page || 1,
        limit: params.limit || 20,
        pages: 1,
      };
    }
    
    const response = await api.get('/api/v1/quotes', { params });
    return response;
  },

  /**
   * Get single quote by ID
   * @param {string|number} id - Quote ID
   * @returns {Promise<Object>} Quote details with items
   */
  getQuoteById: async (id) => {
    if (IS_DEMO_MODE) {
      return {
        id: parseInt(id),
        quote_number: `QT-2024-${String(id).padStart(3, '0')}`,
        customer_name: 'Demo Customer',
        customer_email: 'demo@customer.com',
        customer_phone: '(555) 123-4567',
        customer_company: 'Demo Company LLC',
        status: 'pending',
        notes: 'Sample quote request',
        items: [
          {
            id: 1,
            quote_id: parseInt(id),
            product_id: 1,
            product_name: 'Sample Chair',
            quantity: 10,
            price_per_unit: 8999, // $89.99 in cents
            subtotal: 89990, // $899.90 in cents
            customization_details: null,
          }
        ],
        subtotal_cents: 89990,
        tax_cents: 0,
        total_cents: 89990,
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      };
    }
    
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
    if (IS_DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        id: parseInt(id),
        quote_number: `QT-2024-${String(id).padStart(3, '0')}`,
        status: status,
        updated_at: new Date().toISOString(),
      };
    }
    
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

