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
const USE_STATIC_CONTENT = import.meta.env.VITE_USE_STATIC_CONTENT !== 'false';

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
      const hasData = data !== undefined && data !== null &&
        !(Array.isArray(data) && data.length === 0);
      if (hasData) {
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
    (content) => content.siteSettings,
    async () => {
      const response = await api.get('/api/v1/content/site-settings');
      return response;
    },
    'Fetching site settings'
  );
};

// Site Settings (Admin - always fetch from DB)
export const getSiteSettingsAdmin = async () => {
  logger.info(CONTEXT, 'Fetching site settings (admin)');
  const response = await api.get('/api/v1/content/site-settings');
  
  // Convert camelCase to snake_case for form compatibility
  if (response) {
    return {
      id: response.id,
      company_name: response.companyName,
      company_tagline: response.companyTagline,
      logo_url: response.logoUrl,
      logo_dark_url: response.logoDarkUrl,
      favicon_url: response.faviconUrl,
      primary_email: response.primaryEmail,
      primary_phone: response.primaryPhone,
      sales_email: response.salesEmail,
      sales_phone: response.salesPhone,
      support_email: response.supportEmail,
      support_phone: response.supportPhone,
      address_line1: response.addressLine1,
      address_line2: response.addressLine2,
      city: response.city,
      state: response.state,
      zip_code: response.zipCode,
      country: response.country,
      business_hours_weekdays: response.businessHoursWeekdays,
      business_hours_saturday: response.businessHoursSaturday,
      business_hours_sunday: response.businessHoursSunday,
      facebook_url: response.facebookUrl,
      instagram_url: response.instagramUrl,
      linkedin_url: response.linkedinUrl,
      twitter_url: response.twitterUrl,
      youtube_url: response.youtubeUrl,
      meta_title: response.metaTitle,
      meta_description: response.metaDescription,
      meta_keywords: response.metaKeywords
    };
  }
  return response;
};

// Company Info
export const getCompanyInfo = async (sectionKey = null) => {
  return getStaticOrAPI(
    (content) => content.companyInfo,
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
    (content) => content.teamMembers,
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
    (content) => content.companyValues,
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
    (content) => content.companyMilestones,
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
    (content) => content.heroSlides,
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
    (content) => content.features,
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
    (content) => content.clientLogos,
    async () => {
      const response = await api.get('/api/v1/content/client-logos');
      return response;
    },
    'Fetching client logos'
  );
};

// Sales Representatives
export const getSalesReps = async () => {
  return getStaticOrAPI(
    (content) => content.salesReps,
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
    (content) => content.getRepByState?.(stateCode),
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
    (content) => content.galleryImages,
    async () => {
      const params = new URLSearchParams(filters).toString();
      const response = await api.get(`/api/v1/content/installations${params ? `?${params}` : ''}`);
      return response;
    },
    'Fetching installations'
  );
};

// Contact Locations
export const getContactLocations = async () => {
  return getStaticOrAPI(
    (content) => content.contactLocations,
    async () => {
      const response = await api.get('/api/v1/content/contact-locations');
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
    (content) => content.finishes || [],
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
    (content) => content.upholsteries || [],
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
    (content) => content.laminates || [],
    async () => {
      const response = await api.get('/api/v1/content/laminates');
      return Array.isArray(response) ? response : [];
    },
    'Fetching laminates'
  );
};

// Hardware
export const getHardware = async () => {
  return getStaticOrAPI(
    (content) => content.hardware || [],
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
    (content) => {
      const catalogs = content.catalogs || [];
      if (catalogType) {
        return catalogs.filter(c => c.catalogType === catalogType);
      }
      return catalogs;
    },
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
  try {
    logger.debug(CONTEXT, `Fetching page content for ${pageSlug}${sectionKey ? ` section ${sectionKey}` : ''}`);
    const url = sectionKey 
      ? `/api/v1/content/page-content/${pageSlug}?section_key=${sectionKey}`
      : `/api/v1/content/page-content/${pageSlug}`;
    const response = await api.get(url);
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

// ==================== UPDATE OPERATIONS ====================

// Update Page Content (Admin only)
export const updatePageContent = async (pageSlug, sectionKey, updates) => {
  try {
    logger.info(CONTEXT, `Updating page content (${pageSlug}/${sectionKey})`);
    const response = await api.patch(`/api/v1/cms-admin/page-content/${pageSlug}/${sectionKey}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating page content', error);
    throw error;
  }
};

// Update Site Settings
export const updateSiteSettings = async (updates) => {
  try {
    logger.info(CONTEXT, 'Updating site settings');
    
    // Backend expects snake_case, form data is already in snake_case, send as-is
    const response = await api.patch('/api/v1/cms-admin/site-settings', updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating site settings', error);
    throw error;
  }
};

// Update Company Info
export const updateCompanyInfo = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating company info ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/company-info/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating company info', error);
    throw error;
  }
};

// Update Team Member
export const updateTeamMember = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating team member ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/team-members/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating team member', error);
    throw error;
  }
};

// Update Hero Slide
export const updateHeroSlide = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating hero slide ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/hero-slides/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating hero slide', error);
    throw error;
  }
};

// Update Feature
export const updateFeature = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating feature ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/features/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating feature', error);
    throw error;
  }
};

// Update Client Logo
export const updateClientLogo = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating client logo ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/client-logos/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating client logo', error);
    throw error;
  }
};

// Update Sales Rep
export const updateSalesRep = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating sales rep ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/sales-reps/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating sales rep', error);
    throw error;
  }
};

// Update Installation
export const updateInstallation = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating installation ${id}`);
    const response = await api.put(`/api/v1/cms-admin/gallery/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating installation', error);
    throw error;
  }
};

// Update Contact Location
export const updateContactLocation = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating contact location ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/contact-locations/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating contact location', error);
    throw error;
  }
};

// Update Company Value
export const updateCompanyValue = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating company value ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/company-values/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating company value', error);
    throw error;
  }
};

// Update Company Milestone
export const updateCompanyMilestone = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating company milestone ${id}`);
    const response = await api.patch(`/api/v1/cms-admin/company-milestones/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating company milestone', error);
    throw error;
  }
};

// ==================== CREATE OPERATIONS ====================

// Create Team Member
export const createTeamMember = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating team member');
    const response = await api.post('/api/v1/cms-admin/team-members', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating team member', error);
    throw error;
  }
};

// Create Hero Slide
export const createHeroSlide = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating hero slide');
    const response = await api.post('/api/v1/cms-admin/hero-slides', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating hero slide', error);
    throw error;
  }
};

// Create Feature
export const createFeature = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating feature');
    const response = await api.post('/api/v1/cms-admin/features', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating feature', error);
    throw error;
  }
};

// Create Client Logo
export const createClientLogo = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating client logo');
    const response = await api.post('/api/v1/cms-admin/client-logos', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating client logo', error);
    throw error;
  }
};

// Create Sales Rep
export const createSalesRep = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating sales rep');
    const response = await api.post('/api/v1/cms-admin/sales-reps', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating sales rep', error);
    throw error;
  }
};

// Create Installation
export const createInstallation = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating installation');
    const response = await api.post('/api/v1/cms-admin/gallery', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating installation', error);
    throw error;
  }
};

// Create Contact Location
export const createContactLocation = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating contact location');
    const response = await api.post('/api/v1/cms-admin/contact-locations', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating contact location', error);
    throw error;
  }
};

// Create Company Value
export const createCompanyValue = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating company value');
    const response = await api.post('/api/v1/cms-admin/company-values', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating company value', error);
    throw error;
  }
};

// Create Company Milestone
export const createCompanyMilestone = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating company milestone');
    const response = await api.post('/api/v1/cms-admin/company-milestones', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating company milestone', error);
    throw error;
  }
};

// Create Company Info Section
export const createCompanyInfo = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating company info');
    const response = await api.post('/api/v1/cms-admin/company-info', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating company info', error);
    throw error;
  }
};

// ==================== DELETE OPERATIONS ====================

// Delete Team Member
export const deleteTeamMember = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting team member ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/team-members/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting team member', error);
    throw error;
  }
};

// Delete Hero Slide
export const deleteHeroSlide = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting hero slide ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/hero-slides/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting hero slide', error);
    throw error;
  }
};

// Delete Feature
export const deleteFeature = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting feature ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/features/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting feature', error);
    throw error;
  }
};

// Delete Client Logo
export const deleteClientLogo = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting client logo ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/client-logos/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting client logo', error);
    throw error;
  }
};

// Delete Sales Rep
export const deleteSalesRep = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting sales rep ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/sales-reps/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting sales rep', error);
    throw error;
  }
};

// Delete Installation
export const deleteInstallation = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting installation ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/gallery/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting installation', error);
    throw error;
  }
};

// Delete Contact Location
export const deleteContactLocation = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting contact location ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/contact-locations/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting contact location', error);
    throw error;
  }
};

// Delete Company Value
export const deleteCompanyValue = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting company value ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/company-values/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting company value', error);
    throw error;
  }
};

// Delete Company Milestone
export const deleteCompanyMilestone = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting company milestone ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/company-milestones/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting company milestone', error);
    throw error;
  }
};

// Delete Company Info
export const deleteCompanyInfo = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting company info ${id}`);
    const response = await api.delete(`/api/v1/cms-admin/company-info/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting company info', error);
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

// Update Product
export const updateProduct = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating product ${id}`);
    const response = await api.patch(`/api/v1/products/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating product', error);
    throw error;
  }
};

// Create Product
export const createProduct = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating product');
    const response = await api.post('/api/v1/products', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating product', error);
    throw error;
  }
};

// Delete Product
export const deleteProduct = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting product ${id}`);
    const response = await api.delete(`/api/v1/products/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting product', error);
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

// Update Category
export const updateCategory = async (id, updates) => {
  try {
    logger.info(CONTEXT, `Updating category ${id}`);
    const response = await api.patch(`/api/v1/products/categories/${id}`, updates);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error updating category', error);
    throw error;
  }
};

// Create Category
export const createCategory = async (data) => {
  try {
    logger.info(CONTEXT, 'Creating category');
    const response = await api.post('/api/v1/products/categories', data);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error creating category', error);
    throw error;
  }
};

// Delete Category
export const deleteCategory = async (id) => {
  try {
    logger.info(CONTEXT, `Deleting category ${id}`);
    const response = await api.delete(`/api/v1/products/categories/${id}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error deleting category', error);
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
  getSalesReps,
  getRepByState,
  getInstallations,
  getContactLocations,
  getFAQs,
  getFAQCategories,
  getCatalogs,
  getPageContent,
  submitFeedback,
  getFeaturedProducts,
  updatePageContent,
  updateSiteSettings,
  updateCompanyInfo,
  updateTeamMember,
  updateHeroSlide,
  updateFeature,
  updateClientLogo,
  updateSalesRep,
  updateInstallation,
  updateContactLocation,
  updateCompanyValue,
  updateCompanyMilestone,
  createTeamMember,
  createHeroSlide,
  createFeature,
  createClientLogo,
  createSalesRep,
  createInstallation,
  createContactLocation,
  createCompanyValue,
  createCompanyMilestone,
  createCompanyInfo,
  deleteTeamMember,
  deleteHeroSlide,
  deleteFeature,
  deleteClientLogo,
  deleteSalesRep,
  deleteInstallation,
  deleteContactLocation,
  deleteCompanyValue,
  deleteCompanyMilestone,
  deleteCompanyInfo,
  getProducts,
  getProductById,
  updateProduct,
  createProduct,
  deleteProduct,
  getCategories,
  updateCategory,
  createCategory,
  deleteCategory
};


