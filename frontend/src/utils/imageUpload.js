/**
 * Image Upload Utility
 * 
 * Handles direct file uploads to the server's filesystem
 * Both frontend and backend are on the same server
 */

import { api } from '../config/apiClient';
import logger from './logger';

const CONTEXT = 'ImageUpload';

const UPLOAD_DIR = '/uploads/images';

export const uploadImage = async (file, subfolder = 'general') => {
  try {
    logger.info(CONTEXT, `Uploading image: ${file.name} to ${subfolder}`);

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 50MB');
    }

    // Upload the file untouched: the server keeps the full-resolution original
    // and generates every smaller rendition (see backend media_service), so
    // shrinking or re-encoding it here would only lose resolution and colour.
    const payload = file;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.${extension}`;

    const formData = new FormData();
    formData.append('file', payload);
    formData.append('subfolder', subfolder);
    formData.append('filename', filename);

    const response = await api.post('/api/v1/admin/upload/image', formData, {
      timeout: 120000,
      retry: 0
    });

    const imageUrl = response.url || `${UPLOAD_DIR}/${subfolder}/${filename}`;
    logger.info(CONTEXT, `Image uploaded successfully: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    logger.error(CONTEXT, 'Image upload failed', error);
    throw error;
  }
};

/**
 * Delete an image from the server
 * @param {string} imageUrl - The URL of the image to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteImage = async (imageUrl) => {
  try {
    logger.info(CONTEXT, `Deleting image: ${imageUrl}`);
    
    // Use axios for delete (includes auth token)
    await api.delete('/api/v1/admin/upload/image', {
      data: { url: imageUrl },
    });
    
    logger.info(CONTEXT, 'Image deleted successfully');
    return true;
    
  } catch (error) {
    logger.error(CONTEXT, 'Image deletion failed', error);
    return false;
  }
};

/**
 * Preview an image file before upload
 * @param {File} file - The image file
 * @returns {Promise<string>} - Data URL for preview
 */
export const previewImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress an image before upload. Preserves transparency when format is image/png.
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number|null} quality - JPEG quality (0-1); ignored for PNG
 * @param {string} format - 'image/jpeg' or 'image/png'
 * @returns {Promise<Blob>} - Compressed image blob
 */
export const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.9, format = 'image/jpeg') => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (format === 'image/png') {
          ctx.clearRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        if (format === 'image/png') {
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        } else {
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality ?? 0.9);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export default {
  uploadImage,
  deleteImage,
  previewImage,
  compressImage,
};

