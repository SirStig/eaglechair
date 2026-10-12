/**
 * Admin 3D studio: configurable product models (.glb) and the material
 * library they are dressed in.
 * Backed by /api/v1/admin/models3d (see backend routes/admin/models3d.py).
 */
import { api } from '../config/apiClient';
import { resolveImageUrl } from '../utils/apiHelpers';

const BASE = '/api/v1/admin/models3d';
const MATERIALS = `${BASE}/materials`;
const UPLOAD = { timeout: 600000, retry: 0 };

const withUrls = (model) => ({
  ...model,
  url: resolveImageUrl(model.url),
  thumbnail_url: model.thumbnail_url ? resolveImageUrl(model.thumbnail_url) : null,
});

const materialUrls = (m) => ({
  ...m,
  url: m.url ? resolveImageUrl(m.url) : null,
  maps: Object.fromEntries(Object.entries(m.maps || {}).map(([k, v]) => [k, resolveImageUrl(v)])),
});

export const listModels = async () => ((await api.get(BASE)).models || []).map(withUrls);

export const uploadModel = async (file, { name = '', productId = null, optimize = true } = {}) => {
  const form = new FormData();
  form.append('file', file, file.name);
  if (name) form.append('name', name);
  if (productId) form.append('product_id', String(productId));
  form.append('optimize', optimize ? 'true' : 'false');
  return withUrls(await api.post(BASE, form, UPLOAD));
};

export const updateModel = async (id, data) => withUrls(await api.patch(`${BASE}/${id}`, data));

export const setModelThumbnail = async (id, blob) => {
  const form = new FormData();
  form.append('file', blob, 'thumbnail.png');
  return withUrls(await api.put(`${BASE}/${id}/thumbnail`, form, UPLOAD));
};

export const deleteModel = (id) => api.delete(`${BASE}/${id}`);

export const listMaterials = async () => {
  const res = await api.get(MATERIALS);
  return { materials: (res.materials || []).map(materialUrls), config: res.config || { defaults: {}, assignments: {} } };
};

/** files: a .glb, loose texture maps, or a .zip of maps */
export const uploadMaterial = async (files, { name = '', kind = '' } = {}) => {
  const form = new FormData();
  for (const file of files) form.append('files', file, file.name);
  if (name) form.append('name', name);
  if (kind) form.append('kind', kind);
  return materialUrls(await api.post(MATERIALS, form, UPLOAD));
};

export const updateMaterial = async (id, data) => materialUrls(await api.patch(`${MATERIALS}/${id}`, data));

export const deleteMaterial = (id) => api.delete(`${MATERIALS}/${id}`);

export const saveMaterialConfig = (config) => api.put(`${MATERIALS}/config`, config);

/** The catalog option tables, by source key (see materialKinds SOURCES). */
export const listCatalogOptions = async () => {
  const [u, f, l] = await Promise.all([
    api.get('/api/v1/admin/upholsteries', { params: { is_active: true, page_size: 500 } }),
    api.get('/api/v1/admin/finishes'),
    api.get('/api/v1/admin/catalog/laminates', { params: { is_active: true } }),
  ]);
  const items = (r) => (Array.isArray(r) ? r : r?.items || []);
  return { upholstery: items(u), finish: items(f), laminate: items(l) };
};

export const searchProducts = (search) =>
  api.get('/api/v1/admin/products', { params: { search: search || undefined, page: 1, page_size: 20 } });

export const getProduct = (id) => api.get(`/api/v1/admin/products/${id}`);
