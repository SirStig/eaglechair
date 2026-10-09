/**
 * Document library: browse/search/upload documents for the admin document picker.
 * Backed by GET /api/v1/admin/upload/documents (see backend document_library_service).
 */
import { api } from '../config/apiClient';

export const listDocuments = ({ q = '', folder = '', kind = '', usage = 'all', usedByType = '', page = 1, pageSize = 60 } = {}) =>
  api.get('/api/v1/admin/upload/documents', {
    params: {
      q: q || undefined,
      folder: folder || undefined,
      kind: kind || undefined,
      used_by_type: usedByType || undefined,
      usage,
      page,
      page_size: pageSize,
    },
  });

/** Upload a document into /uploads/documents/<subfolder>; resolves to its URL. */
export const uploadDocument = async (file, subfolder = 'general') => {
  const form = new FormData();
  form.append('file', file);
  form.append('subfolder', subfolder);
  // Catalog PDFs can be hundreds of MB: allow a long upload and never retry it
  const res = await api.post('/api/v1/admin/upload/document', form, { timeout: 600000, retry: 0 });
  return res.url;
};

/** Permanently delete an uploaded document. The server refuses (409) while a record still uses it. */
export const deleteDocument = (url) =>
  api.delete('/api/v1/admin/upload/document', { data: { url } });

export default { listDocuments, uploadDocument, deleteDocument };
