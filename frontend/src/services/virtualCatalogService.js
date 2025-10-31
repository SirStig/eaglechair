/**
 * Virtual Catalog Service
 * Handles API calls for PDF catalog upload and parsing
 */

import { api } from '../config/apiClient';

const API_BASE = '/api/v1/admin/virtual-catalog';

class VirtualCatalogService {
  /**
   * Upload a PDF catalog file
   * @param {File} file - PDF file to upload
   * @param {number} maxPages - Optional limit for testing
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise} Upload response with upload_id
   */
  async uploadCatalog(file, maxPages = null, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    };

    let url = `${API_BASE}/upload`;
    if (maxPages) {
      url += `?max_pages=${maxPages}`;
    }

    const response = await api.post(url, formData, config);
    return response;  // api client already unwraps response.data in interceptor
  }

  /**
   * Get upload/parse status
   * @param {string} uploadId - Upload session ID
   * @returns {Promise} Status information
   */
  async getUploadStatus(uploadId) {
    const response = await api.get(`${API_BASE}/upload/${uploadId}/status`);
    return response;  // api client already unwraps response.data
  }

  /**
   * List recent uploads
   * @param {number} limit - Max number of uploads to return
   * @returns {Promise} List of recent uploads
   */
  async listRecentUploads(limit = 10) {
    const response = await api.get(`${API_BASE}/uploads/recent`, {
      params: { limit }
    });
    return response;  // api client already unwraps response.data
  }

  /**
   * List temporary product families
   * @param {string} uploadId - Optional filter by upload session
   * @param {number} skip - Pagination offset
   * @param {number} limit - Items per page
   * @returns {Promise} List of families
   */
  async listTmpFamilies(uploadId = null, skip = 0, limit = 50) {
    const params = { skip, limit };
    if (uploadId) params.upload_id = uploadId;

    return await api.get(`${API_BASE}/tmp/families`, { params });
  }

  /**
   * List temporary products
   * @param {string} uploadId - Optional filter by upload session
   * @param {number} familyId - Optional filter by family
   * @param {number} skip - Pagination offset
   * @param {number} limit - Items per page
   * @returns {Promise} List of products
   */
  async listTmpProducts(uploadId = null, familyId = null, skip = 0, limit = 50) {
    const params = { skip, limit };
    if (uploadId) params.upload_id = uploadId;
    if (familyId) params.family_id = familyId;

    return await api.get(`${API_BASE}/tmp/products`, { params });
  }

  /**
   * Get temporary product details
   * @param {number} productId - Product ID
   * @returns {Promise} Product details with variations and images
   */
  async getTmpProduct(productId) {
    const response = await api.get(`${API_BASE}/tmp/products/${productId}`);
    return response;  // api client already unwraps response.data
  }

  /**
   * Update temporary product
   * @param {number} productId - Product ID
   * @param {Object} updates - Fields to update
   * @returns {Promise} Update response
   */
  async updateTmpProduct(productId, updates) {
    const response = await api.put(`${API_BASE}/tmp/products/${productId}`, updates);
    return response;  // api client already unwraps response.data
  }

  /**
   * Delete/skip temporary product
   * @param {number} productId - Product ID
   * @returns {Promise} Delete response
   */
  async deleteTmpProduct(productId) {
    const response = await api.delete(`${API_BASE}/tmp/products/${productId}`);
    return response;  // api client already unwraps response.data
  }

  /**
   * Delete upload session and all associated data
   * @param {string} uploadId - Upload session ID
   * @returns {Promise} Delete response with statistics
   */
  async deleteUploadSession(uploadId) {
    return await api.delete(`${API_BASE}/upload/${uploadId}`);
  }

  /**
   * Import approved data to production
   * @param {string} uploadId - Upload session ID
   * @returns {Promise} Import results
   */
  async importToProduction(uploadId) {
    const response = await api.post(`${API_BASE}/import`, { upload_id: uploadId });
    return response;  // api client already unwraps response.data
  }

  /**
   * Clean up expired temporary data
   * @returns {Promise} Cleanup results
   */
  async cleanupExpired() {
    const response = await api.post(`${API_BASE}/cleanup`);
    return response;  // api client already unwraps response.data
  }
}

export default new VirtualCatalogService();
export { VirtualCatalogService };
