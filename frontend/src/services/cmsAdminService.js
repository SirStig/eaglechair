import { api } from '../config/apiClient';
import logger from '../utils/logger';

/**
 * CMS Admin Service
 *
 * Admin-only write operations for CMS content (and the inline product/category
 * editors). Kept out of contentService so public pages don't ship this code:
 * public pages load it on demand with `import('../services/cmsAdminService')`.
 *
 * Cache invalidation is NOT done here: the API client reports every
 * successful admin write to utils/cmsContentStore (notifyAdminWrite), which
 * clears the public content caches, bumps the shared content version and
 * warns when the backend responds with `exported: false`.
 */

const CONTEXT = 'CmsAdminService';

// Keys the editors carry along that are never part of a write payload
const NON_PAYLOAD_KEYS = new Set(['id', 'index', 'createdAt', 'updatedAt', 'created_at', 'updated_at']);

const toSnake = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/**
 * Convert the camelCase shape exported to contentData.json into the
 * snake_case the /cms-admin endpoints accept. `renames` maps export-only
 * field names (e.g. hero `image`) to their API names. Keys that are already
 * snake_case win over a camelCase duplicate.
 */
const toApiPayload = (data = {}, renames = {}) => {
  const out = {};
  const explicit = new Set();
  Object.entries(data).forEach(([key, value]) => {
    if (NON_PAYLOAD_KEYS.has(key) || value === undefined) return;
    const apiKey = renames[key] || toSnake(key);
    const isExplicit = key === apiKey;
    if (!isExplicit && explicit.has(apiKey)) return;
    if (isExplicit) explicit.add(apiKey);
    out[apiKey] = value;
  });
  return out;
};

const HERO_RENAMES = { image: 'background_image_url' };
const GALLERY_RENAMES = {
  title: 'project_name',
  category: 'project_type',
  url: 'primary_image',
  order: 'display_order',
};
const TEAM_RENAMES = { image: 'photo_url' };

const run = async (description, request) => {
  try {
    logger.info(CONTEXT, description);
    return await request();
  } catch (error) {
    logger.error(CONTEXT, `Failed: ${description}`, error);
    throw error;
  }
};

// ==================== SITE SETTINGS ====================

// Site Settings (Admin - always fetch from DB), snake_case for the form
export const getSiteSettingsAdmin = async () => {
  logger.info(CONTEXT, 'Fetching site settings (admin)');
  const response = await api.get('/api/v1/content/site-settings');
  if (!response) return response;
  const { id, ...rest } = response;
  return { id, ...toApiPayload(rest) };
};

export const updateSiteSettings = (updates) =>
  run('Updating site settings', () =>
    api.patch('/api/v1/cms-admin/site-settings', toApiPayload(updates)));

// ==================== PAGE CONTENT ====================

export const updatePageContent = (pageSlug, sectionKey, updates) =>
  run(`Updating page content (${pageSlug}/${sectionKey})`, () => {
    const payload = toApiPayload(updates);
    delete payload.page_slug;
    delete payload.section_key;
    return api.patch(`/api/v1/cms-admin/page-content/${pageSlug}/${sectionKey}`, payload);
  });

// ==================== HERO SLIDES ====================

export const createHeroSlide = (data) =>
  run('Creating hero slide', () =>
    api.post('/api/v1/cms-admin/hero-slides', toApiPayload(data, HERO_RENAMES)));

export const updateHeroSlide = (id, updates) =>
  run(`Updating hero slide ${id}`, () =>
    api.patch(`/api/v1/cms-admin/hero-slides/${id}`, toApiPayload(updates, HERO_RENAMES)));

export const deleteHeroSlide = (id) =>
  run(`Deleting hero slide ${id}`, () => api.delete(`/api/v1/cms-admin/hero-slides/${id}`));

// ==================== COMPANY INFO ====================

export const createCompanyInfo = (data) =>
  run('Creating company info', () => api.post('/api/v1/cms-admin/company-info', toApiPayload(data)));

export const updateCompanyInfo = (id, updates) =>
  run(`Updating company info ${id}`, () =>
    api.patch(`/api/v1/cms-admin/company-info/${id}`, toApiPayload(updates)));

export const deleteCompanyInfo = (id) =>
  run(`Deleting company info ${id}`, () => api.delete(`/api/v1/cms-admin/company-info/${id}`));

// ==================== TEAM MEMBERS ====================

export const createTeamMember = (data) =>
  run('Creating team member', () =>
    api.post('/api/v1/cms-admin/team-members', toApiPayload(data, TEAM_RENAMES)));

export const updateTeamMember = (id, updates) =>
  run(`Updating team member ${id}`, () =>
    api.patch(`/api/v1/cms-admin/team-members/${id}`, toApiPayload(updates, TEAM_RENAMES)));

export const deleteTeamMember = (id) =>
  run(`Deleting team member ${id}`, () => api.delete(`/api/v1/cms-admin/team-members/${id}`));

// ==================== FEATURES ====================

export const createFeature = (data) =>
  run('Creating feature', () => api.post('/api/v1/cms-admin/features', toApiPayload(data)));

export const updateFeature = (id, updates) =>
  run(`Updating feature ${id}`, () =>
    api.patch(`/api/v1/cms-admin/features/${id}`, toApiPayload(updates)));

export const deleteFeature = (id) =>
  run(`Deleting feature ${id}`, () => api.delete(`/api/v1/cms-admin/features/${id}`));

// ==================== CLIENT LOGOS ====================

export const createClientLogo = (data) =>
  run('Creating client logo', () => api.post('/api/v1/cms-admin/client-logos', toApiPayload(data)));

export const updateClientLogo = (id, updates) =>
  run(`Updating client logo ${id}`, () =>
    api.patch(`/api/v1/cms-admin/client-logos/${id}`, toApiPayload(updates)));

export const deleteClientLogo = (id) =>
  run(`Deleting client logo ${id}`, () => api.delete(`/api/v1/cms-admin/client-logos/${id}`));

// ==================== TESTIMONIALS ====================

export const createTestimonial = (data) =>
  run('Creating testimonial', () => api.post('/api/v1/cms-admin/testimonials', toApiPayload(data)));

export const updateTestimonial = (id, updates) =>
  run(`Updating testimonial ${id}`, () =>
    api.patch(`/api/v1/cms-admin/testimonials/${id}`, toApiPayload(updates)));

export const deleteTestimonial = (id) =>
  run(`Deleting testimonial ${id}`, () => api.delete(`/api/v1/cms-admin/testimonials/${id}`));

// ==================== SALES REPS ====================

export const createSalesRep = (data) =>
  run('Creating sales rep', () => api.post('/api/v1/cms-admin/sales-reps', toApiPayload(data)));

export const updateSalesRep = (id, updates) =>
  run(`Updating sales rep ${id}`, () =>
    api.patch(`/api/v1/cms-admin/sales-reps/${id}`, toApiPayload(updates)));

export const deleteSalesRep = (id) =>
  run(`Deleting sales rep ${id}`, () => api.delete(`/api/v1/cms-admin/sales-reps/${id}`));

// ==================== GALLERY / INSTALLATIONS ====================

export const createInstallation = (data) =>
  run('Creating installation', () =>
    api.post('/api/v1/cms-admin/gallery', toApiPayload(data, GALLERY_RENAMES)));

export const updateInstallation = (id, updates) =>
  run(`Updating installation ${id}`, () =>
    api.put(`/api/v1/cms-admin/gallery/${id}`, toApiPayload(updates, GALLERY_RENAMES)));

export const deleteInstallation = (id) =>
  run(`Deleting installation ${id}`, () => api.delete(`/api/v1/cms-admin/gallery/${id}`));

// ==================== CONTACT LOCATIONS ====================

export const createContactLocation = (data) =>
  run('Creating contact location', () =>
    api.post('/api/v1/cms-admin/contact-locations', toApiPayload(data)));

export const updateContactLocation = (id, updates) =>
  run(`Updating contact location ${id}`, () =>
    api.patch(`/api/v1/cms-admin/contact-locations/${id}`, toApiPayload(updates)));

export const deleteContactLocation = (id) =>
  run(`Deleting contact location ${id}`, () => api.delete(`/api/v1/cms-admin/contact-locations/${id}`));

// ==================== COMPANY VALUES ====================

export const createCompanyValue = (data) =>
  run('Creating company value', () => api.post('/api/v1/cms-admin/company-values', toApiPayload(data)));

export const updateCompanyValue = (id, updates) =>
  run(`Updating company value ${id}`, () =>
    api.patch(`/api/v1/cms-admin/company-values/${id}`, toApiPayload(updates)));

export const deleteCompanyValue = (id) =>
  run(`Deleting company value ${id}`, () => api.delete(`/api/v1/cms-admin/company-values/${id}`));

// ==================== COMPANY MILESTONES ====================

export const createCompanyMilestone = (data) =>
  run('Creating company milestone', () =>
    api.post('/api/v1/cms-admin/company-milestones', toApiPayload(data)));

export const updateCompanyMilestone = (id, updates) =>
  run(`Updating company milestone ${id}`, () =>
    api.patch(`/api/v1/cms-admin/company-milestones/${id}`, toApiPayload(updates)));

export const deleteCompanyMilestone = (id) =>
  run(`Deleting company milestone ${id}`, () => api.delete(`/api/v1/cms-admin/company-milestones/${id}`));

// ==================== PRODUCTS / CATEGORIES (inline editors) ====================

export const updateProduct = (id, updates) =>
  run(`Updating product ${id}`, () => api.patch(`/api/v1/products/${id}`, updates));

export const createProduct = (data) =>
  run('Creating product', () => api.post('/api/v1/products', data));

export const deleteProduct = (id) =>
  run(`Deleting product ${id}`, () => api.delete(`/api/v1/products/${id}`));

export const updateCategory = (id, updates) =>
  run(`Updating category ${id}`, () => api.patch(`/api/v1/products/categories/${id}`, updates));

export const createCategory = (data) =>
  run('Creating category', () => api.post('/api/v1/products/categories', data));

export const deleteCategory = (id) =>
  run(`Deleting category ${id}`, () => api.delete(`/api/v1/products/categories/${id}`));
