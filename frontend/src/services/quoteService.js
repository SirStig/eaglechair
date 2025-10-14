import { api, IS_DEMO_MODE } from '../config/apiClient';

/**
 * Quote Service
 * Handles quote request and management API calls
 */

export const quoteService = {
  /**
   * Submit quote request
   * @param {FormData} formData - Quote data with files
   * @returns {Promise<Object>} Created quote
   */
  createQuote: async (formData) => {
    if (IS_DEMO_MODE) {
      // Demo mode - simulate quote creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        id: Date.now(),
        number: `QT-2024-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
    }
    
    return await api.upload('/api/v1/quotes', formData);
  },

  /**
   * Get all quotes for current user
   * @returns {Promise<Array>} User's quotes
   */
  getQuotes: async () => {
    if (IS_DEMO_MODE) {
      // Demo mode - return sample quotes
      return [
        {
          id: 1,
          number: 'QT-2024-001',
          date: '2024-01-15',
          status: 'pending',
          items: 5,
          total: 12500,
        },
        {
          id: 2,
          number: 'QT-2024-002',
          date: '2024-01-10',
          status: 'approved',
          items: 8,
          total: 18750,
        },
      ];
    }
    
    return await api.get('/api/v1/quotes');
  },

  /**
   * Get single quote by ID
   * @param {string|number} id - Quote ID
   * @returns {Promise<Object>} Quote details
   */
  getQuoteById: async (id) => {
    if (IS_DEMO_MODE) {
      return {
        id: id,
        number: `QT-2024-${String(id).padStart(3, '0')}`,
        date: '2024-01-15',
        status: 'pending',
        items: [],
        total: 0,
      };
    }
    
    return await api.get(`/api/v1/quotes/${id}`);
  },
};

export default quoteService;

