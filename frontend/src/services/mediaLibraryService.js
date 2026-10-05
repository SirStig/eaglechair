/**
 * Media library: browse/search uploaded images for the admin image picker.
 * Backed by GET /api/v1/admin/upload/images (see backend media_library_service).
 */
import { api } from '../config/apiClient';

export const listMediaImages = ({ q = '', folder = '', usage = 'all', usedByType = '', page = 1, pageSize = 60 } = {}) =>
  api.get('/api/v1/admin/upload/images', {
    params: {
      q: q || undefined,
      folder: folder || undefined,
      used_by_type: usedByType || undefined,
      usage,
      page,
      page_size: pageSize,
    },
  });

/** Permanently delete an uploaded image. The server refuses (409) while a record still uses it. */
export const deleteMediaImage = (url) =>
  api.delete('/api/v1/admin/upload/image', { data: { url } });

export default { listMediaImages, deleteMediaImage };
