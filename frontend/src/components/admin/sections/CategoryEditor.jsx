import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Category Editor Component
 * Separate component for editing/creating categories with image upload
 */
const CategoryEditor = ({ category, categories, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    parent_id: category?.parent_id || null,
    icon_url: category?.icon_url || '',
    banner_image_url: category?.banner_image_url || '',
    meta_title: category?.meta_title || '',
    meta_description: category?.meta_description || '',
    display_order: category?.display_order || 0,
    is_active: category?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(null); // 'icon_url' or 'banner_image_url'

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(field);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'categories');
      
      const response = await apiClient.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = response.url;
      handleChange(field, imageUrl);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const deleteImage = async (field, currentUrl) => {
    if (!confirm('Delete this image?')) return;
    
    try {
      if (currentUrl) {
        await apiClient.delete('/api/v1/admin/upload/image', {
          data: { url: currentUrl }
        });
      }
      handleChange(field, '');
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const renderImageControl = (field, label) => {
    const isUploading = uploadingImage === field;
    const currentValue = formData[field];
    const isIcon = field === 'icon_url';
    
    return (
      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          {label}
        </label>
        {currentValue ? (
          <div className="relative group">
            <img 
              src={resolveImageUrl(currentValue)} 
              alt={label}
              className={`object-cover rounded-lg border border-dark-600 ${isIcon ? 'w-32 h-32' : 'w-full h-32'}`}
            />
            <button
              onClick={() => deleteImage(field, currentValue)}
              className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              type="button"
              title="Delete image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="relative block">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, field)}
              className="hidden"
              disabled={isUploading}
            />
            <div className={`flex flex-col items-center justify-center border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${isIcon ? 'h-32 w-32' : 'h-32 w-full'} ${isUploading ? 'opacity-50' : ''}`}>
              {isUploading ? (
                <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-10 h-10 text-dark-500 mb-2" />
                  <span className="text-sm text-dark-400">Upload {label.toLowerCase()}</span>
                  <span className="text-xs text-dark-500 mt-1">PNG, JPG</span>
                </>
              )}
            </div>
          </label>
        )}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (category) {
        await apiClient.put(`/api/v1/admin/categories/${category.id}`, formData);
      } else {
        await apiClient.post('/api/v1/admin/categories', formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(error.response?.data?.detail || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          disabled={saving}
        >
          <ArrowLeft className="w-5 h-5 text-dark-300" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-dark-50">
            {category ? `Edit: ${category.name}` : 'Create Category'}
          </h2>
          <p className="text-dark-300 mt-1">
            {category ? 'Update category details and images' : 'Add a new product category'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="bg-dark-800 border-dark-700">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Chairs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleChange('slug', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="chairs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                placeholder="Brief description of this category"
              />
            </div>

            {/* Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Images
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {renderImageControl('icon_url', 'Icon Image')}
                {renderImageControl('banner_image_url', 'Banner Image')}
              </div>
              <p className="text-xs text-dark-400 mt-2">
                Icon: Square image for category display. Banner: Wide banner for category header.
              </p>
            </div>

            {/* SEO */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                SEO
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={formData.meta_title}
                    onChange={(e) => handleChange('meta_title', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="SEO title for search engines"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Meta Description
                  </label>
                  <textarea
                    value={formData.meta_description}
                    onChange={(e) => handleChange('meta_description', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="SEO description for search engines"
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Parent Category
                  </label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={(e) => handleChange('parent_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">None (Top-level category)</option>
                    {categories.filter(cat => !cat.parent_id && cat.id !== category?.id).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex gap-6 mt-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Active</span>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="bg-dark-600 hover:bg-dark-500 text-dark-200 px-6 py-3"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || !formData.name || !formData.slug}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {saving ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CategoryEditor;
