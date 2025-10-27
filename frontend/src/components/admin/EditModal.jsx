import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import { uploadImage, previewImage } from '../../utils/imageUpload';
import logger from '../../utils/logger';

const CONTEXT = 'EditModal';

/**
 * EditModal Component
 * 
 * Generic modal for editing content
 * Handles text, textarea, images, and complex objects
 */
const EditModal = ({ isOpen, onClose, onSave, elementData, elementType }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (isOpen && elementData) {
      setFormData(elementData);
      setError(null);
      setImagePreview(null);
    }
  }, [isOpen, elementData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Show preview
      const preview = await previewImage(file);
      setImagePreview({ [fieldName]: preview });
      
      // Upload image
      setUploadingImage(true);
      const subfolder = elementType || 'general';
      const imageUrl = await uploadImage(file, subfolder);
      
      setFormData(prev => ({ ...prev, [fieldName]: imageUrl }));
      logger.info(CONTEXT, `Image uploaded for ${fieldName}: ${imageUrl}`);
      
    } catch (err) {
      logger.error(CONTEXT, 'Image upload failed', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await onSave(formData);
      logger.info(CONTEXT, `Content saved for ${elementType}`);
    } catch (err) {
      logger.error(CONTEXT, `Error saving content for ${elementType}:`, err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (key, value) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
    
    // Skip certain fields
    if (['id', 'createdAt', 'updatedAt', 'displayOrder', 'isActive'].includes(key)) {
      return null;
    }

    // Image fields
    if (key.toLowerCase().includes('image') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('logo') || key.toLowerCase().includes('url') && value?.startsWith('/uploads')) {
      return (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          
          {/* Current Image */}
          {(imagePreview?.[key] || formData[key]) && (
            <div className="relative w-full max-w-md mx-auto bg-dark-700 rounded-lg overflow-hidden">
              <img
                src={imagePreview?.[key] || formData[key]}
                alt={label}
                className="w-full h-auto max-h-64 object-contain"
              />
            </div>
          )}
          
          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageSelect(e, key)}
                className="hidden"
                disabled={uploadingImage}
              />
              <div className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-50 rounded-lg transition-colors border border-dark-500 text-sm font-medium">
                {uploadingImage ? 'Uploading...' : 'Choose Image'}
              </div>
            </label>
            {formData[key] && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, [key]: '' }))}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-100 rounded-lg transition-colors border border-red-700 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      );
    }

    // Long text fields (textarea)
    if (typeof value === 'string' && (value.length > 100 || key.toLowerCase().includes('description') || key.toLowerCase().includes('content') || key.toLowerCase().includes('bio'))) {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <textarea
            id={key}
            name={key}
            value={formData[key] || ''}
            onChange={handleChange}
            rows={key.toLowerCase().includes('content') || key.toLowerCase().includes('description') ? 6 : 4}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
          />
        </div>
      );
    }

    // Regular text fields
    if (typeof value === 'string' || typeof value === 'number') {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <input
            id={key}
            name={key}
            type={typeof value === 'number' ? 'number' : 'text'}
            value={formData[key] || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-dark-800 rounded-xl shadow-2xl border border-dark-600 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600">
            <h2 className="text-xl font-semibold text-dark-50">
              Edit {elementType?.charAt(0).toUpperCase() + elementType?.slice(1)}
            </h2>
            <button
              onClick={onClose}
              className="text-dark-300 hover:text-dark-50 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {elementData && Object.keys(elementData).map(key => renderField(key, elementData[key]))}
            
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-100 text-sm">
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-600 bg-dark-750">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || uploadingImage}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || uploadingImage}
            >
              {loading ? 'Saving...' : uploadingImage ? 'Uploading...' : 'Save Changes'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditModal;
