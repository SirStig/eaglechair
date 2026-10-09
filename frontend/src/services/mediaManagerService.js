/**
 * Media Library page: every uploaded image and document, where each is used,
 * versions, replace / detach / delete, and the image editor's server helpers.
 * Backed by /api/v1/admin/media (see backend media_manager_service).
 */
import { api } from '../config/apiClient';

const BASE = '/api/v1/admin/media';

export const listMedia = (kind, { q = '', folder = '', usage = 'all', usedByType = '', docKind = '', sort = 'newest', page = 1, pageSize = 60 } = {}) =>
  api.get(`${BASE}/${kind === 'image' ? 'images' : 'documents'}`, {
    params: {
      q: q || undefined,
      folder: folder || undefined,
      used_by_type: usedByType || undefined,
      kind: kind === 'document' && docKind ? docKind : undefined,
      usage,
      sort,
      page,
      page_size: pageSize,
    },
  });

export const getMediaDetails = (kind, url) => api.get(`${BASE}/details`, { params: { kind, url } });

export const getMediaCapabilities = () => api.get(`${BASE}/capabilities`);

/** The image's bytes from the API (same origin), so the editor canvas can read its pixels. */
export const fetchImageBlob = (url) =>
  api.get(`${BASE}/raw`, { params: { url }, responseType: 'blob', timeout: 120000 });

/**
 * Store `file` as the new current version of `url` (records follow, the old
 * file becomes an earlier version). `action`: 'replaced' | 'edited'.
 */
export const replaceMedia = (kind, url, file, { action = 'replaced', note, filename } = {}) => {
  const form = new FormData();
  form.append('file', file, filename || file.name || 'upload');
  form.append('kind', kind);
  form.append('url', url);
  form.append('action', action);
  if (note) form.append('note', note);
  return api.post(`${BASE}/replace`, form, { timeout: 600000, retry: 0 });
};

/** Take a file off records. `targets`: [{model, id}], or null for every record. */
export const detachMedia = (kind, url, targets = null) => api.post(`${BASE}/detach`, { kind, url, targets });

export const restoreMediaVersion = (id) => api.post(`${BASE}/versions/${id}/restore`);

export const deleteMediaVersion = (id) => api.delete(`${BASE}/versions/${id}`);

/** Delete files (and their versions). With `detach`, in-use files are taken off their records first. */
export const deleteMediaFiles = (kind, urls, { detach = false } = {}) =>
  api.delete(`${BASE}/files`, { data: { kind, urls, detach } });

/** PNG blob with the background removed. `method`: 'white' | 'ai'. */
export const removeBackground = (blob, method = 'white') => {
  const form = new FormData();
  form.append('file', blob, 'image.png');
  form.append('method', method);
  return api.post(`${BASE}/remove-background`, form, { responseType: 'blob', timeout: 300000, retry: 0 });
};

export default {
  listMedia,
  getMediaDetails,
  getMediaCapabilities,
  fetchImageBlob,
  replaceMedia,
  detachMedia,
  restoreMediaVersion,
  deleteMediaVersion,
  deleteMediaFiles,
  removeBackground,
};
