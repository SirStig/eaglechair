import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';
import ImagePickerField from '../media/ImagePickerField';

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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    <AdminPage>
      <AdminPageHeader
        onBack={onBack}
        backDisabled={saving}
        backLabel="Back to Hardware"
        eyebrow="Materials & Options"
        title={hardware ? `Edit: ${hardware.name}` : 'Create Hardware'}
        description={hardware ? 'Update hardware details and images' : 'Add a new hardware component'}
      />

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
                <ImagePickerField
                  label="Main Image"
                  value={formData.image_url}
                  onChange={(url) => handleChange('image_url', url)}
                  subfolder="hardware"
                  previewClassName="h-32 w-48"
                  objectFit="cover"
                  disabled={saving}
                  libraryTitle="Choose hardware image"
                />
                <ImagePickerField
                  label="Thumbnail Image"
                  value={formData.thumbnail_url}
                  onChange={(url) => handleChange('thumbnail_url', url)}
                  subfolder="hardware"
                  previewClassName="h-32 w-48"
                  objectFit="cover"
                  disabled={saving}
                  libraryTitle="Choose hardware thumbnail"
                />
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
    </AdminPage>
  );
};

export default HardwareEditor;
