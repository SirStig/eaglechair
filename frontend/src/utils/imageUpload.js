/**
 * Image Upload Utility
 * 
 * Handles direct file uploads to the server's filesystem
 * Both frontend and backend are on the same server
 */

import logger from './logger';

const CONTEXT = 'ImageUpload';

// Upload directory on the server (relative to project root)
const UPLOAD_DIR = '/uploads/images';

/**
 * Upload an image file directly to the server
 * @param {File} file - The image file to upload
 * @param {string} subfolder - Optional subfolder (e.g., 'products', 'team', 'hero')
 * @returns {Promise<string>} - The URL path to the uploaded image
 */
export const uploadImage = async (file, subfolder = 'general') => {
  try {
    logger.info(CONTEXT, `Uploading image: ${file.name} to ${subfolder}`);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 10MB');
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${randomStr}.${extension}`;
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subfolder', subfolder);
    formData.append('filename', filename);
    
    // Upload to backend endpoint
    const response = await fetch('/api/v1/upload/image', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }
    
    const data = await response.json();
    const imageUrl = data.url || `${UPLOAD_DIR}/${subfolder}/${filename}`;
    
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
    
    const response = await fetch('/api/v1/upload/image', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: imageUrl }),
    });
    
    if (!response.ok) {
      throw new Error('Delete failed');
    }
    
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
 * Compress an image before upload
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} - Compressed image blob
 */
export const compressImage = (file, maxWidth = 1920, maxHeight = 1080, quality = 0.9) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions
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
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          quality
        );
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

