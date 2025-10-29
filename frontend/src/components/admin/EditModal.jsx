import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
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
      logger.debug(CONTEXT, `Modal opened with elementType: ${elementType}, data:`, elementData);
    }
  }, [isOpen, elementData, elementType]);

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
    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
    
    // Skip certain fields - auto-generated or internal
    if (['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'view_count', 'viewCount', 'index'].includes(key)) {
      return null;
    }

    // Special case: Sales rep states_covered field - render state selector
    if (elementType === 'sales-rep' && (key === 'states_covered' || key === 'statesCovered')) {
      const statesByRegion = {
        'Northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
        'Southeast': ['MD', 'DE', 'VA', 'WV', 'KY', 'NC', 'SC', 'TN', 'GA', 'FL', 'AL', 'MS', 'LA'],
        'Midwest': ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
        'Southwest': ['TX', 'OK', 'AR', 'NM', 'AZ'],
        'West': ['CO', 'WY', 'MT', 'ID', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI'],
      };
      
      const allStates = Object.values(statesByRegion).flat();
      const currentStates = formData[key] || [];
      
      const toggleState = (stateCode) => {
        const newStates = currentStates.includes(stateCode)
          ? currentStates.filter(s => s !== stateCode)
          : [...currentStates, stateCode];
        setFormData(prev => ({ ...prev, [key]: newStates }));
      };
      
      const selectRegion = (states) => {
        setFormData(prev => ({ ...prev, [key]: states }));
      };
      
      return (
        <div key={key} className="space-y-3">
          <label className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          
          {/* Quick selection buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => selectRegion(allStates)}
              className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-dark-900 rounded transition-colors font-semibold"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => selectRegion([])}
              className="px-3 py-1 text-xs bg-dark-600 text-dark-100 rounded hover:bg-dark-500 transition-colors"
            >
              Clear
            </button>
            {Object.entries(statesByRegion).map(([region, states]) => (
              <button
                key={region}
                type="button"
                onClick={() => selectRegion(states)}
                className="px-3 py-1 text-xs bg-dark-600 text-dark-100 rounded hover:bg-dark-500 transition-colors"
              >
                {region}
              </button>
            ))}
          </div>
          
          {/* Selection summary */}
          <div className="bg-dark-700 p-3 rounded-lg">
            <div className="text-sm text-dark-100">
              <strong className="text-dark-50">Selected:</strong> {currentStates.length > 0 ? (
                <span className="text-primary-500 font-medium">{currentStates.sort().join(', ')}</span>
              ) : (
                <span className="text-dark-300">None</span>
              )}
            </div>
          </div>
          
          {/* State grid by region */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {Object.entries(statesByRegion).map(([region, states]) => (
              <div key={region} className="bg-dark-700 p-3 rounded-lg">
                <h4 className="text-sm font-semibold text-dark-50 mb-2">{region}</h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {states.map(stateCode => {
                    const isSelected = currentStates.includes(stateCode);
                    return (
                      <button
                        key={stateCode}
                        type="button"
                        onClick={() => toggleState(stateCode)}
                        className={`
                          px-2 py-1.5 rounded text-xs font-medium transition-all
                          ${isSelected 
                            ? 'bg-primary-600 text-dark-900 border-2 border-primary-500 shadow-lg' 
                            : 'bg-dark-600 text-dark-100 border-2 border-dark-500 hover:bg-dark-500 hover:border-dark-400'
                          }
                        `}
                      >
                        {stateCode}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Skip other arrays (like images array) - too complex for simple form
    if (Array.isArray(value)) {
      return null;
    }

    // Exclude LinkedIn/social URLs from image detection
    if (key === 'linkedin_url' || key === 'linkedinUrl') {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <input
            id={key}
            name={key}
            type="url"
            value={formData[key] ?? ''}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/username"
            className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>
      );
    }

    // Detect if this is an image field - either by field name OR by value being an image URL
    const imageFieldNames = ['primary_image', 'primaryImage', 'background_image_url', 'backgroundImageUrl', 
                             'image_url', 'imageUrl', 'logo_url', 'logoUrl', 'photo_url', 'photoUrl',
                             'url', 'logo', 'image', 'photo', 'background', 'backgroundImage', 'cta_image'];
    const isImageFieldByName = imageFieldNames.some(name => key.toLowerCase().includes(name.toLowerCase()));
    const isImageURL = typeof value === 'string' && (
      value.startsWith('http://') || 
      value.startsWith('https://') || 
      value.startsWith('/uploads/') ||
      value.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
    );
    const isImageField = isImageFieldByName || isImageURL;
    
    if (isImageField) {
      const currentImage = imagePreview?.[key] || formData[key];
      
      return (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          
          {/* Current Image Preview */}
          {currentImage && (
            <div className="relative w-full max-w-md mx-auto bg-dark-700 rounded-lg overflow-hidden border-2 border-dark-500">
              <img
                src={currentImage}
                alt={label}
                className="w-full h-auto max-h-64 object-contain"
                onError={(e) => {
                  // If image fails to load, hide the preview
                  e.target.style.display = 'none';
                }}
              />
              {/* Image overlay showing it's the current image */}
              <div className="absolute top-2 left-2 px-2 py-1 bg-dark-900/80 text-dark-50 text-xs rounded">
                Current Image
              </div>
            </div>
          )}
          
          {/* Upload/Replace Button */}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageSelect(e, key)}
                className="hidden"
                disabled={uploadingImage}
              />
              <div className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-dark-900 rounded-lg transition-colors border border-primary-500 text-sm font-semibold">
                {uploadingImage ? 'Uploading...' : currentImage ? 'Replace Image' : 'Upload Image'}
              </div>
            </label>
            {formData[key] && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, [key]: '' }));
                  setImagePreview(prev => ({ ...prev, [key]: null }));
                }}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-100 rounded-lg transition-colors border border-red-700 text-sm font-medium"
              >
                Remove Image
              </button>
            )}
          </div>
        </div>
      );
    }

    // Boolean fields (checkboxes) - check key name pattern
    const booleanFields = ['is_active', 'is_featured', 'isActive', 'isFeatured', 'is_published', 'isPublished'];
    if (booleanFields.includes(key) || typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center gap-3">
          <input
            id={key}
            name={key}
            type="checkbox"
            checked={formData[key] || false}
            onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
            className="w-5 h-5 bg-dark-700 border border-dark-500 rounded text-accent-500 focus:ring-2 focus:ring-accent-500"
          />
          <label htmlFor={key} className="text-sm font-medium text-dark-100">
            {label}
          </label>
        </div>
      );
    }

    // Number fields - check key name or if value is a number
    const numberFields = ['display_order', 'displayOrder', 'order', 'sort_order', 'sortOrder'];
    if (numberFields.includes(key) || (typeof value === 'number' && !booleanFields.includes(key))) {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <input
            id={key}
            name={key}
            type="number"
            value={formData[key] ?? ''}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>
      );
    }

    // Long text fields (textarea) - check key name or length
    const textareaFields = ['description', 'content', 'bio', 'full_description', 'fullDescription'];
    const shouldBeTextarea = textareaFields.some(field => key.toLowerCase().includes(field)) || 
                            (typeof value === 'string' && value.length > 100);
    
    if (shouldBeTextarea) {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <textarea
            id={key}
            name={key}
            value={formData[key] ?? ''}
            onChange={handleChange}
            rows={6}
            className="w-full px-4 py-2 bg-dark-700 border border-dark-500 rounded-lg text-dark-50 placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
          />
        </div>
      );
    }

    // Default: Regular text fields (includes null/undefined values)
    if (value === null || value === undefined || typeof value === 'string') {
      return (
        <div key={key} className="space-y-2">
          <label htmlFor={key} className="block text-sm font-medium text-dark-100">
            {label}
          </label>
          <input
            id={key}
            name={key}
            type="text"
            value={formData[key] ?? ''}
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
            {elementData && Object.keys(elementData).length > 0 ? (
              Object.keys(elementData).map(key => renderField(key, elementData[key]))
            ) : (
              <div className="text-center py-8 text-dark-300">
                No editable fields available for this {elementType}
              </div>
            )}
            
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
