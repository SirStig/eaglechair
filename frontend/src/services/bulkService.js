import apiClient from '../config/apiClient';

/**
 * Apply one change set to many admin rows.
 *
 * resource: products | variations | categories | subcategories | families |
 *   finishes | colors | upholsteries | laminates | hardware | catalogs |
 *   pricing-tiers | inquiries | email-templates | legal-documents
 *
 * Resolves to { updated, missing }.
 */
export const bulkEdit = (resource, ids, changes) =>
  apiClient.post(`/api/v1/admin/bulk/${resource}`, { ids, changes });

/**
 * Permanently delete rows that are already retired (deactivated, archived,
 * declined…). Super admin only; active rows and rows still in use (e.g. a
 * product on a quote) are skipped. Resolves to { deleted, skipped: [{id, name, reason}] }.
 */
export const permanentDelete = (resource, ids) =>
  apiClient.post(`/api/v1/admin/bulk/${resource}/delete`, { ids, confirm: 'DELETE' });

export default { bulkEdit, permanentDelete };
