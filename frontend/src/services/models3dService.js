/**
 * Admin 3D model library: configurable product models (.glb).
 * Backed by /api/v1/admin/models3d (see backend routes/admin/models3d.py).
 */
import { api } from '../config/apiClient';

const BASE = '/api/v1/admin/models3d';

export const listModels = () => api.get(BASE);

export const uploadModel = (file, { name = '', productId = null } = {}) => {
  const form = new FormData();
  form.append('file', file, file.name);
  if (name) form.append('name', name);
  if (productId) form.append('product_id', String(productId));
  return api.post(BASE, form, { timeout: 600000, retry: 0 });
};

export const updateModel = (id, data) => api.patch(`${BASE}/${id}`, data);

export const deleteModel = (id) => api.delete(`${BASE}/${id}`);

export const listUpholsteries = () =>
  api.get('/api/v1/admin/upholsteries', { params: { is_active: true, page_size: 500 } });

export const listFinishes = () => api.get('/api/v1/admin/finishes');

export const searchProducts = (search) =>
  api.get('/api/v1/admin/products', { params: { search: search || undefined, page: 1, page_size: 20 } });
