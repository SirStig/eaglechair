import { api } from '../config/apiClient';
import logger from '../utils/logger';

const CONTEXT = 'SEOService';

/**
 * SEO Service
 * 
 * Provides functions to fetch SEO metadata for products and families
 */
export const seoService = {
  /**
   * Get SEO metadata for a product
   */
  async getProductSEO(productIdOrSlug) {
    try {
      const response = await api.get(`/api/v1/seo/product/${productIdOrSlug}`);
      return response;
    } catch (error) {
      logger.error(CONTEXT, `Failed to fetch product SEO: ${productIdOrSlug}`, error);
      return null;
    }
  },

  /**
   * Get SEO metadata for a product family
   */
  async getFamilySEO(familySlug) {
    try {
      const response = await api.get(`/api/v1/seo/family/${familySlug}`);
      return response;
    } catch (error) {
      logger.error(CONTEXT, `Failed to fetch family SEO: ${familySlug}`, error);
      return null;
    }
  },
};

export default seoService;

