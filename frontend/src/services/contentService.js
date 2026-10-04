import { api } from '../config/apiClient';
import logger from '../utils/logger';
import { loadContentData } from '../utils/contentDataLoader';
import productService from './productService';

// DO NOT import contentData statically - it gets bundled and cached
// Instead we use loadContentData() which fetches from /data/ at runtime

const CONTEXT = 'ContentService';

/**
 * Content Service
 * Handles fetching CMS content - uses static files for instant loading with API fallback
 * 
 * For static content (hero images, site settings, reps, gallery, etc.):
 * - Primary: Static contentData.js (instant, no API call)
 * - Fallback: API call if static content fails/missing
 * 
 * For dynamic content (products, FAQs, etc.):
 * - Always uses API
 */

// Check if we should use static content (can be disabled via env var)
export const USE_STATIC_CONTENT = import.meta.env.VITE_USE_STATIC_CONTENT !== 'false';

const installationTypeFilter = (filters = {}) =>
  filters.project_type || filters.projectType || filters.category || null;

/**
 * Pure selectors over contentData.json. Shared by the async getters below and
 * by useContent(), which uses them to render synchronously when the content
 * is already in memory (SSR payload / earlier load) - so server and client
 * render the same markup with no loading flash.
 *
 * Returning undefined/null means "not in the static export - ask the API".
 */
export const staticSelectors = {
  siteSettings: (content) => content.siteSettings,
  companyInfo: (content) => content.companyInfo,
  teamMembers: (content) => content.teamMembers,
  companyValues: (content) => content.companyValues,
  companyMilestones: (content) => content.companyMilestones,
  heroSlides: (content) => content.heroSlides,
  features: (content, featureType = 'general') => {
    const features = content.features || [];
    return features.filter((f) => f.featureType === featureType);
  },
  clientLogos: (content) => content.clientLogos,
  testimonials: (content) => content.testimonials,
  salesReps: (content) => content.salesReps,
  repByState: (content, stateCode) => content.getRepByState?.(stateCode),
  installations: (content, filters = {}) => {
    const images = content.galleryImages;
    const projectType = installationTypeFilter(filters);
    if (!Array.isArray(images) || !projectType) return images;
    return images.filter((img) => (img.category || img.projectType || img.project_type) === projectType);
  },
  contactLocations: (content) => content.contactLocations,
  finishes: (content) => content.finishes || [],
  upholsteries: (content) => content.upholsteries || [],
  laminates: (content) => content.laminates || [],
  hardware: (content) => content.hardware || [],
  productInstalls: (content) => content.productInstalls || [],
  catalogs: (content, catalogType = null) => {
    const catalogs = content.catalogs || [];
    if (catalogType) {
      return catalogs.filter(c => c.catalogType === catalogType);
    }
    return catalogs;
  },
  // Only sections present in the export; others fall back to the API,
  // which serves server-side defaults.
  pageContent: (content, pageSlug, sectionKey = null) => {
    const rows = (content.pageContent || []).filter(
      (row) => row.pageSlug === pageSlug && row.isActive !== false &&
        (!sectionKey || row.sectionKey === sectionKey)
    );
    if (!rows.length) return undefined;
    const normalized = rows.map((row) => ({
      ...row,
      title: row.title || '',
      subtitle: row.subtitle || '',
      content: row.content || '',
      ctaStyle: row.ctaStyle || '',
    }));
    return sectionKey && normalized.length === 1 ? normalized[0] : normalized;
  },
};

/**
 * Helper to get static content with API fallback
 * Loads contentData dynamically from /data/ (not bundled)
 */
const getStaticOrAPI = async (getDataFn, apiFetcher, contextMessage) => {
  // If static content is disabled, use API
  if (!USE_STATIC_CONTENT) {
    logger.debug(CONTEXT, `${contextMessage} (API mode)`);
    return await apiFetcher();
  }

  // Try static content first (loaded dynamically from /data/)
  try {
    const staticContent = await loadContentData();
    if (staticContent) {
      const data = getDataFn(staticContent);
      // An empty array is a real answer ("no slides configured"), not a
      // reason to hit the API on every visit.
      if (data !== undefined && data !== null) {
        logger.debug(CONTEXT, `${contextMessage} (from static file)`);
        return data;
      }
    }
  } catch (error) {
    logger.warn(CONTEXT, `Static content unavailable, falling back to API: ${error.message}`);
  }

  // Fallback to API
  logger.debug(CONTEXT, `${contextMessage} (API fallback)`);
  return await apiFetcher();
};

// Site Settings
export const getSiteSettings = async () => {
  return getStaticOrAPI(
    staticSelectors.siteSettings,
    async () => {
      const response = await api.get('/api/v1/content/site-settings');
      return response;
    },
    'Fetching site settings'
  );
};

// Company Info
export const getCompanyInfo = async (sectionKey = null) => {
  return getStaticOrAPI(
    staticSelectors.companyInfo,
    async () => {
      const url = sectionKey 
        ? `/api/v1/content/company-info/${sectionKey}`
        : '/api/v1/content/company-info';
      const response = await api.get(url);
      return response;
    },
    `Fetching company info${sectionKey ? ` for ${sectionKey}` : ''}`
  );
};

// Team Members
export const getTeamMembers = async () => {
  return getStaticOrAPI(
    staticSelectors.teamMembers,
    async () => {
      const response = await api.get('/api/v1/content/team-members');
      return response;
    },
    'Fetching team members'
  );
};

// Company Values
export const getCompanyValues = async () => {
  return getStaticOrAPI(
    staticSelectors.companyValues,
    async () => {
      const response = await api.get('/api/v1/content/company-values');
      return response;
    },
    'Fetching company values'
  );
};

// Company Milestones
export const getCompanyMilestones = async () => {
  return getStaticOrAPI(
    staticSelectors.companyMilestones,
    async () => {
      const response = await api.get('/api/v1/content/company-milestones');
      return response;
    },
    'Fetching company milestones'
  );
};

// Hero Slides
export const getHeroSlides = async () => {
  return getStaticOrAPI(
    staticSelectors.heroSlides,
    async () => {
      const response = await api.get('/api/v1/content/hero-slides');
      return response;
    },
    'Fetching hero slides'
  );
};

// Features (Why Choose Us)
export const getFeatures = async (featureType = 'general') => {
  return getStaticOrAPI(
    (content) => staticSelectors.features(content, featureType),
    async () => {
      const response = await api.get(`/api/v1/content/features?type=${featureType}`);
      return response;
    },
    `Fetching features of type: ${featureType}`
  );
};

// Client Logos
export const getClientLogos = async () => {
  return getStaticOrAPI(
    staticSelectors.clientLogos,
    async () => {
      const response = await api.get('/api/v1/content/client-logos');
      return response;
    },
    'Fetching client logos'
  );
};

// Testimonials
export const getTestimonials = async () => {
  return getStaticOrAPI(
    staticSelectors.testimonials,
    async () => {
      const response = await api.get('/api/v1/content/testimonials');
      return response;
    },
    'Fetching testimonials'
  );
};

// Sales Representatives
export const getSalesReps = async () => {
  return getStaticOrAPI(
    staticSelectors.salesReps,
    async () => {
      const response = await api.get('/api/v1/content/sales-reps');
      return response;
    },
    'Fetching sales representatives'
  );
};

// Get rep by state
export const getRepByState = async (stateCode) => {
  return getStaticOrAPI(
    (content) => staticSelectors.repByState(content, stateCode),
    async () => {
      const response = await api.get(`/api/v1/content/sales-reps/state/${stateCode}`);
      return response;
    },
    `Fetching rep for state: ${stateCode}`
  );
};

// Installation Gallery
export const getInstallations = async (filters = {}) => {
  return getStaticOrAPI(
    (content) => staticSelectors.installations(content, filters),
    async () => {
      // GET /content/installations (cms_content) only filters by project_type
      const projectType = installationTypeFilter(filters);
      const params = projectType ? { project_type: projectType } : undefined;
      const response = await api.get('/api/v1/content/installations', { params });
      return response;
    },
    'Fetching installations'
  );
};

// Contact Locations
export const getContactLocations = async () => {
  return getStaticOrAPI(
    staticSelectors.contactLocations,
    async () => {
      const response = await api.get('/api/v1/content/contact/locations');
      return response;
    },
    'Fetching contact locations'
  );
};

// FAQs
export const getFAQs = async (categoryId = null) => {
  try {
    logger.debug(CONTEXT, `Fetching FAQs${categoryId ? ` for category ${categoryId}` : ''}`);
    const url = categoryId 
      ? `/api/v1/content/faqs?category=${categoryId}`
      : '/api/v1/content/faqs';
    const response = await api.get(url);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching FAQs', error);
    throw error;
  }
};

// FAQ Categories
export const getFAQCategories = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching FAQ categories');
    const response = await api.get('/api/v1/content/faq-categories');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching FAQ categories', error);
    throw error;
  }
};

// Finishes
export const getFinishes = async () => {
  return getStaticOrAPI(
    staticSelectors.finishes,
    async () => {
      const response = await api.get('/api/v1/finishes');
      return Array.isArray(response) ? response : [];
    },
    'Fetching finishes'
  );
};

// Upholsteries
export const getUpholsteries = async () => {
  return getStaticOrAPI(
    staticSelectors.upholsteries,
    async () => {
      const response = await api.get('/api/v1/upholsteries');
      return Array.isArray(response) ? response : [];
    },
    'Fetching upholsteries'
  );
};

// Laminates
export const getLaminates = async () => {
  return getStaticOrAPI(
    staticSelectors.laminates,
    async () => {
      const response = await api.get('/api/v1/content/laminates');
      return Array.isArray(response) ? response : [];
    },
    'Fetching laminates'
  );
};

// Hardware
// Install photos shown only on product pages; they live in the static export.
export const getProductInstalls = async () => {
  return getStaticOrAPI(staticSelectors.productInstalls, async () => [], 'Fetching product installs');
};

export const getHardware = async () => {
  return getStaticOrAPI(
    staticSelectors.hardware,
    async () => {
      const response = await api.get('/api/v1/content/hardware');
      return Array.isArray(response) ? response : [];
    },
    'Fetching hardware'
  );
};

// Catalogs/Resources
export const getCatalogs = async (catalogType = null) => {
  return getStaticOrAPI(
    (content) => staticSelectors.catalogs(content, catalogType),
    async () => {
      const url = catalogType
        ? `/api/v1/content/catalogs?type=${catalogType}`
        : '/api/v1/content/catalogs';
      const response = await api.get(url);
      return Array.isArray(response) ? response : [];
    },
    `Fetching catalogs${catalogType ? ` of type ${catalogType}` : ''}`
  );
};

// Page Content (flexible content blocks)
export const getPageContent = async (pageSlug, sectionKey = null) => {
  // Serve from the static export when it has the section; the API is only
  // needed for sections that fall back to server-side defaults.
  if (USE_STATIC_CONTENT) {
    try {
      const staticContent = await loadContentData();
      const section = staticContent ? staticSelectors.pageContent(staticContent, pageSlug, sectionKey) : undefined;
      if (section !== undefined) return section;
    } catch (error) {
      logger.warn(CONTEXT, `Static page content unavailable: ${error.message}`);
    }
  }
  try {
    logger.debug(CONTEXT, `Fetching page content for ${pageSlug}${sectionKey ? ` section ${sectionKey}` : ''}`);
    const url = sectionKey 
      ? `/api/v1/content/page-content/${pageSlug}?section_key=${sectionKey}`
      : `/api/v1/content/page-content/${pageSlug}`;
    const response = await api.get(url);
    if (sectionKey && Array.isArray(response) && response.length === 1) return response[0];
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching page content', error);
    throw error;
  }
};

// Submit Feedback/Contact Form
export const submitFeedback = async (feedbackData) => {
  try {
    logger.info(CONTEXT, 'Submitting feedback');
    const response = await api.post('/api/v1/content/feedback', feedbackData);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error submitting feedback', error);
    throw error;
  }
};

// Get Featured Products
export const getFeaturedProducts = async (limit = 4) => {
  try {
    logger.info(CONTEXT, `Fetching featured products (limit=${limit})`);
    
    // Use productService for consistency - it handles both demo and real API
    return await productService.getFeaturedProducts(limit);
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching featured products', error);
    throw error;
  }
};

// ==================== PRODUCT OPERATIONS ====================

// Get Products
export const getProducts = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    logger.debug(CONTEXT, `Fetching products with filters: ${params}`);
    const response = await api.get(`/api/v1/products${params ? `?${params}` : ''}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching products', error);
    throw error;
  }
};

// Get Product by ID
export const getProductById = async (id) => {
  try {
    logger.debug(CONTEXT, `Fetching product ${id}`);
    const response = await api.get(`/api/v1/products/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching product', error);
    throw error;
  }
};

// Get Categories
export const getCategories = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching categories');
    const response = await api.get('/api/v1/products/categories');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching categories', error);
    throw error;
  }
};

export default {
  getSiteSettings,
  getCompanyInfo,
  getTeamMembers,
  getCompanyValues,
  getCompanyMilestones,
  getHeroSlides,
  getFeatures,
  getClientLogos,
  getTestimonials,
  getSalesReps,
  getRepByState,
  getInstallations,
  getContactLocations,
  getFAQs,
  getFAQCategories,
  getFinishes,
  getUpholsteries,
  getLaminates,
  getHardware,
  getProductInstalls,
  getCatalogs,
  getPageContent,
  submitFeedback,
  getFeaturedProducts,
  getProducts,
  getProductById,
  getCategories
};


