import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Hardware Editor Component
 * Separate component for editing/creating hardware with image upload
 */
const HardwareEditor = ({ hardware, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: hardware?.name || '',
    category: hardware?.category || '',
    description: hardware?.description || '',
    material: hardware?.material || '',
    finish: hardware?.finish || '',
    dimensions: hardware?.dimensions || '',
    weight_capacity: hardware?.weight_capacity || '',
    model_number: hardware?.model_number || '',
    sku: hardware?.sku || '',
    image_url: hardware?.image_url || '',
    thumbnail_url: hardware?.thumbnail_url || '',
    compatible_with: hardware?.compatible_with || '',
    installation_notes: hardware?.installation_notes || '',
    list_price: hardware?.list_price || 0,
    display_order: hardware?.display_order || 0,
    is_active: hardware?.is_active !== false,
    is_featured: hardware?.is_featured || false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event, imageType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imageType === 'main') {
      setUploadingImage(true);
    } else {
      setUploadingThumbnail(true);
    }
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'hardware');
      
      const response = await apiClient.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (imageType === 'main') {
        handleChange('image_url', response.url);
      } else {
        handleChange('thumbnail_url', response.url);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      if (imageType === 'main') {
        setUploadingImage(false);
      } else {
        setUploadingThumbnail(false);
      }
    }
  };

  const deleteImage = async (imageType) => {
    if (!confirm(`Delete this ${imageType} image?`)) return;
    
    try {
      const url = imageType === 'main' ? formData.image_url : formData.thumbnail_url;
      if (url) {
        await apiClient.delete('/api/v1/admin/upload/image', {
          data: { url }
        });
      }
      if (imageType === 'main') {
        handleChange('image_url', '');
      } else {
        handleChange('thumbnail_url', '');
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const submitData = {
        ...formData,
        list_price: formData.list_price ? parseInt(formData.list_price) : null
      };
      
      if (hardware) {
        await apiClient.put(`/api/v1/admin/catalog/hardware/${hardware.id}`, submitData);
      } else {
        await apiClient.post('/api/v1/admin/catalog/hardware', submitData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save hardware:', error);
      alert(error.response?.data?.detail || 'Failed to save hardware');
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
            {hardware ? `Edit: ${hardware.name}` : 'Create Hardware'}
          </h2>
          <p className="text-dark-300 mt-1">
            {hardware ? 'Update hardware details and images' : 'Add a new hardware component'}
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
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Heavy Duty Caster"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Casters, Glides, Table Bases"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.model_number}
                    onChange={(e) => handleChange('model_number', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Model number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="SKU code"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  placeholder="Description of this hardware component"
                />
              </div>
            </div>

            {/* Specifications */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Specifications
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Material
                  </label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => handleChange('material', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Steel, Nylon"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Finish
                  </label>
                  <input
                    type="text"
                    value={formData.finish}
                    onChange={(e) => handleChange('finish', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Polished, Brushed, Black Powder Coat"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={formData.dimensions}
                    onChange={(e) => handleChange('dimensions', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 1.5 inch diameter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Weight Capacity
                  </label>
                  <input
                    type="text"
                    value={formData.weight_capacity}
                    onChange={(e) => handleChange('weight_capacity', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 500 lbs"
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Images
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Main Image
                  </label>
                  {formData.image_url ? (
                    <div className="relative group inline-block">
                      <img 
                        src={resolveImageUrl(formData.image_url)} 
                        alt="Hardware"
                        className="w-48 h-32 object-cover rounded-lg border border-dark-600"
                      />
                      <button
                        onClick={() => deleteImage('main')}
                        className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="relative block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'main')}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      <div className={`flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
                        {uploadingImage ? (
                          <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-dark-500 mb-2" />
                            <span className="text-sm text-dark-400">Upload image</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Thumbnail Image
                  </label>
                  {formData.thumbnail_url ? (
                    <div className="relative group inline-block">
                      <img 
                        src={resolveImageUrl(formData.thumbnail_url)} 
                        alt="Thumbnail"
                        className="w-48 h-32 object-cover rounded-lg border border-dark-600"
                      />
                      <button
                        onClick={() => deleteImage('thumbnail')}
                        className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="relative block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'thumbnail')}
                        className="hidden"
                        disabled={uploadingThumbnail}
                      />
                      <div className={`flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingThumbnail ? 'opacity-50' : ''}`}>
                        {uploadingThumbnail ? (
                          <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-dark-500 mb-2" />
                            <span className="text-sm text-dark-400">Upload thumbnail</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Compatibility & Installation */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Compatibility & Installation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Compatible With
                  </label>
                  <textarea
                    value={formData.compatible_with}
                    onChange={(e) => handleChange('compatible_with', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Which products/categories this works with"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Installation Notes
                  </label>
                  <textarea
                    value={formData.installation_notes}
                    onChange={(e) => handleChange('installation_notes', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Installation instructions and notes"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Display */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Pricing & Display
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    List Price (cents)
                  </label>
                  <input
                    type="number"
                    value={formData.list_price}
                    onChange={(e) => handleChange('list_price', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                  <p className="text-xs text-dark-400 mt-1">Optional - may be quote-only</p>
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

              <div className="flex flex-wrap gap-4 mt-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Active</span>
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => handleChange('is_featured', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Featured</span>
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
            disabled={saving || !formData.name}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {saving ? 'Saving...' : hardware ? 'Update Hardware' : 'Create Hardware'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default HardwareEditor;
