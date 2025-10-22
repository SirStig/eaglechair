import { api } from '../config/apiClient';
import logger from '../utils/logger';

const CONTEXT = 'ContentService';

/**
 * Content Service
 * Handles fetching CMS content from backend
 */

// Site Settings
export const getSiteSettings = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching site settings');
    const response = await api.get('/api/v1/content/site-settings');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching site settings', error);
    throw error;
  }
};

// Company Info
export const getCompanyInfo = async (sectionKey = null) => {
  try {
    logger.debug(CONTEXT, `Fetching company info${sectionKey ? ` for ${sectionKey}` : ''}`);
    const url = sectionKey 
      ? `/api/v1/content/company-info/${sectionKey}`
      : '/api/v1/content/company-info';
    const response = await api.get(url);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching company info', error);
    throw error;
  }
};

// Team Members
export const getTeamMembers = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching team members');
    const response = await api.get('/api/v1/content/team-members');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching team members', error);
    throw error;
  }
};

// Company Values
export const getCompanyValues = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching company values');
    const response = await api.get('/api/v1/content/company-values');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching company values', error);
    throw error;
  }
};

// Company Milestones
export const getCompanyMilestones = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching company milestones');
    const response = await api.get('/api/v1/content/company-milestones');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching company milestones', error);
    throw error;
  }
};

// Hero Slides
export const getHeroSlides = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching hero slides');
    const response = await api.get('/api/v1/content/hero-slides');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching hero slides', error);
    throw error;
  }
};

// Features (Why Choose Us)
export const getFeatures = async (featureType = 'general') => {
  try {
    logger.debug(CONTEXT, `Fetching features of type: ${featureType}`);
    const response = await api.get(`/api/v1/content/features?type=${featureType}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching features', error);
    throw error;
  }
};

// Client Logos
export const getClientLogos = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching client logos');
    const response = await api.get('/api/v1/content/client-logos');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching client logos', error);
    throw error;
  }
};

// Sales Representatives
export const getSalesReps = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching sales representatives');
    const response = await api.get('/api/v1/content/sales-reps');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching sales reps', error);
    throw error;
  }
};

// Get rep by state
export const getRepByState = async (stateCode) => {
  try {
    logger.debug(CONTEXT, `Fetching rep for state: ${stateCode}`);
    const response = await api.get(`/api/v1/content/sales-reps/state/${stateCode}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching rep by state', error);
    throw error;
  }
};

// Installation Gallery
export const getInstallations = async (filters = {}) => {
  try {
    logger.debug(CONTEXT, 'Fetching installations', filters);
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/api/v1/content/installations${params ? `?${params}` : ''}`);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching installations', error);
    throw error;
  }
};

// Contact Locations
export const getContactLocations = async () => {
  try {
    logger.debug(CONTEXT, 'Fetching contact locations');
    const response = await api.get('/api/v1/content/contact-locations');
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching contact locations', error);
    throw error;
  }
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

// Catalogs/Resources
export const getCatalogs = async (catalogType = null) => {
  try {
    logger.debug(CONTEXT, `Fetching catalogs${catalogType ? ` of type ${catalogType}` : ''}`);
    const url = catalogType 
      ? `/api/v1/content/catalogs?type=${catalogType}`
      : '/api/v1/content/catalogs';
    const response = await api.get(url);
    return response;
  } catch (error) {
    logger.error(CONTEXT, 'Error fetching catalogs', error);
    throw error;
  }
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
    const response = await api.get(`/api/v1/content/featured-products?limit=${limit}`);
    return response;
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
    const response = await api.patch(`/api/v1/content/page-content/${pageSlug}/${sectionKey}`, updates);
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
    const response = await api.patch('/api/v1/cms-content/site-settings', updates);
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
    const response = await api.patch(`/api/v1/cms-content/company-info/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/team-members/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/hero-slides/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/features/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/client-logos/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/sales-reps/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/installations/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/contact-locations/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/company-values/${id}`, updates);
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
    const response = await api.patch(`/api/v1/cms-content/company-milestones/${id}`, updates);
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
    const response = await api.post('/api/v1/cms-content/team-members', data);
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
    const response = await api.post('/api/v1/cms-content/hero-slides', data);
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
    const response = await api.post('/api/v1/cms-content/features', data);
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
    const response = await api.post('/api/v1/cms-content/client-logos', data);
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
    const response = await api.post('/api/v1/cms-content/sales-reps', data);
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
    const response = await api.post('/api/v1/cms-content/installations', data);
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
    const response = await api.post('/api/v1/cms-content/contact-locations', data);
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
    const response = await api.post('/api/v1/cms-content/company-values', data);
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
    const response = await api.post('/api/v1/cms-content/company-milestones', data);
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
    const response = await api.post('/api/v1/cms-content/company-info', data);
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
    const response = await api.delete(`/api/v1/cms-content/team-members/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/hero-slides/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/features/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/client-logos/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/sales-reps/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/installations/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/contact-locations/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/company-values/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/company-milestones/${id}`);
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
    const response = await api.delete(`/api/v1/cms-content/company-info/${id}`);
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

