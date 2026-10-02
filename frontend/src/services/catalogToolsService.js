/**
 * Admin catalog tools: Catalog Builder (projects, previews, PDF export),
 * product base exports and the product register.
 *
 * Backend: backend/api/v1/routes/admin/{catalog_builder,exports,register}.py
 */
import apiClient from '../config/apiClient';

const BUILDER = '/api/v1/admin/catalog-builder';
const EXPORTS = '/api/v1/admin/exports';
const REGISTER = '/api/v1/admin/register';

// Rendering is CPU work on the server: allow time, never auto-retry it
const RENDER_OPTIONS = { timeout: 180000, retry: 0 };

/** Save a Blob as a file download. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// Projects
export const listProjects = () => apiClient.get(`${BUILDER}/projects`);
export const getProject = (id) => apiClient.get(`${BUILDER}/projects/${id}`);
export const createProject = (body) => apiClient.post(`${BUILDER}/projects`, body);
export const saveProject = (id, body) => apiClient.put(`${BUILDER}/projects/${id}`, body);
export const duplicateProject = (id) => apiClient.post(`${BUILDER}/projects/${id}/duplicate`);
export const deleteProject = (id) => apiClient.delete(`${BUILDER}/projects/${id}`);

// Rendering
export const previewPage = (document, pageIndex, { signal, dpi } = {}) =>
  apiClient.post(
    `${BUILDER}/preview`,
    { document, page_index: pageIndex, ...(dpi ? { dpi } : {}) },
    { ...RENDER_OPTIONS, signal }
  );

/** The whole catalog as a PDF Blob. */
export const exportCatalog = (document, { filename, projectId } = {}) =>
  apiClient.post(
    `${BUILDER}/export`,
    { document, filename, project_id: projectId ?? null },
    { ...RENDER_OPTIONS, responseType: 'blob' }
  );

// Pickers
export const suggestPages = (body) => apiClient.post(`${BUILDER}/suggest-pages`, body);
export const searchProducts = (params) => apiClient.get(`${BUILDER}/products`, { params });
export const getProductsByIds = (ids) =>
  ids.length ? apiClient.get(`${BUILDER}/products`, { params: { ids: ids.join(','), limit: 500 } }) : Promise.resolve([]);
export const listFamilies = () => apiClient.get(`${BUILDER}/families`);
export const uploadCatalogImage = (file) => {
  const form = new FormData();
  form.append('file', file);
  form.append('subfolder', 'catalog');
  return apiClient.post('/api/v1/admin/upload/image', form, { timeout: 120000, retry: 0 });
};

// Product base exports
const today = () => new Date().toISOString().slice(0, 10);

export const downloadProductsExcel = async (includeInactive = true) => {
  const blob = await apiClient.get(`${EXPORTS}/products.xlsx`, {
    params: { include_inactive: includeInactive },
    responseType: 'blob',
    ...RENDER_OPTIONS,
  });
  saveBlob(blob, `Eagle Chair Products ${today()}.xlsx`);
};

export const downloadProductIndex = async (includeInactive = false) => {
  const blob = await apiClient.get(`${EXPORTS}/product-index.pdf`, {
    params: { include_inactive: includeInactive },
    responseType: 'blob',
    ...RENDER_OPTIONS,
  });
  saveBlob(blob, `Eagle Chair Product Index ${today()}.pdf`);
};

// Product register
export const getRegister = () => apiClient.get(REGISTER);
export const bulkUpdateProducts = (body) => apiClient.post(`${REGISTER}/bulk`, body);
export const updateVariation = (id, body) => apiClient.patch(`${REGISTER}/variations/${id}`, body);
export const updateProduct = (id, body) => apiClient.patch(`/api/v1/admin/products/${id}`, body);
