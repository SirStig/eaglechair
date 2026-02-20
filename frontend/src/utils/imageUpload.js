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
const COMPRESS_THRESHOLD = 500 * 1024;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;
const COMPRESS_QUALITY_JPEG = 0.9;
const PRESERVE_TRANSPARENCY_TYPES = ['image/png', 'image/webp', 'image/gif'];

const isCompressibleRaster = (file) => {
  if (!file.type.startsWith('image/')) return false;
  if (file.type === 'image/svg+xml') return false;
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
};

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

    const skipCompression = subfolder === 'hero' || subfolder === 'hero-slide' || String(subfolder).startsWith('hero');
    let payload = file;
    let extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    if (!skipCompression && isCompressibleRaster(file) && file.size > COMPRESS_THRESHOLD) {
      const preserveTransparency = PRESERVE_TRANSPARENCY_TYPES.includes(file.type);
      const blob = await compressImage(file, MAX_WIDTH, MAX_HEIGHT, preserveTransparency ? null : COMPRESS_QUALITY_JPEG, preserveTransparency ? 'image/png' : 'image/jpeg');
      extension = preserveTransparency ? 'png' : 'jpg';
      const mime = preserveTransparency ? 'image/png' : 'image/jpeg';
      payload = new File([blob], file.name.replace(/\.[^.]+$/, `.${extension}`), { type: mime });
      logger.debug(CONTEXT, `Compressed ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB (${extension})`);
    }

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

