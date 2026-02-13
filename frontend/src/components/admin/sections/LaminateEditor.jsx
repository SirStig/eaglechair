import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Laminate Editor Component
 * Separate component for editing/creating laminates with image upload
 */
const LaminateEditor = ({ laminate, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    brand: laminate?.brand || '',
    pattern_name: laminate?.pattern_name || '',
    pattern_code: laminate?.pattern_code || '',
    description: laminate?.description || '',
    color_family: laminate?.color_family || '',
    finish_type: laminate?.finish_type || '',
    thickness: laminate?.thickness || '',
    grade: laminate?.grade || '',
    supplier_name: laminate?.supplier_name || '',
    supplier_website: laminate?.supplier_website || '',
    supplier_contact: laminate?.supplier_contact || '',
    swatch_image_url: laminate?.swatch_image_url || '',
    full_image_url: laminate?.full_image_url || '',
    is_in_stock: laminate?.is_in_stock !== false,
    lead_time_days: laminate?.lead_time_days || '',
    minimum_order: laminate?.minimum_order || '',
    price_per_sheet: laminate?.price_per_sheet || 0,
    recommended_for: laminate?.recommended_for || '',
    care_instructions: laminate?.care_instructions || '',
    display_order: laminate?.display_order || 0,
    is_active: laminate?.is_active !== false,
    is_featured: laminate?.is_featured || false,
    is_popular: laminate?.is_popular || false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingSwatch, setUploadingSwatch] = useState(false);
  const [uploadingFullImage, setUploadingFullImage] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event, imageType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imageType === 'swatch') {
      setUploadingSwatch(true);
    } else {
      setUploadingFullImage(true);
    }
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'laminates');
      
      const response = await apiClient.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (imageType === 'swatch') {
        handleChange('swatch_image_url', response.url);
      } else {
        handleChange('full_image_url', response.url);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      if (imageType === 'swatch') {
        setUploadingSwatch(false);
      } else {
        setUploadingFullImage(false);
      }
    }
  };

  const deleteImage = async (imageType) => {
    if (!confirm(`Delete this ${imageType} image?`)) return;
    
    try {
      const url = imageType === 'swatch' ? formData.swatch_image_url : formData.full_image_url;
      if (url) {
        await apiClient.delete('/api/v1/admin/upload/image', {
          data: { url }
        });
      }
      if (imageType === 'swatch') {
        handleChange('swatch_image_url', '');
      } else {
        handleChange('full_image_url', '');
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
        lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
        price_per_sheet: formData.price_per_sheet ? parseInt(formData.price_per_sheet) : null
      };
      
      if (laminate) {
        await apiClient.put(`/api/v1/admin/catalog/laminates/${laminate.id}`, submitData);
      } else {
        await apiClient.post('/api/v1/admin/catalog/laminates', submitData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save laminate:', error);
      alert(error.response?.data?.detail || 'Failed to save laminate');
    } finally {
      setSaving(false);
    }
  };

  const isUploading = uploadingSwatch || uploadingFullImage;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
          disabled={saving || isUploading}
        >
          <ArrowLeft className="w-5 h-5 text-dark-300" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-dark-50">
            {laminate ? `Edit: ${laminate.brand} - ${laminate.pattern_name}` : 'Create Laminate'}
          </h2>
          <p className="text-dark-300 mt-1">
            {laminate ? 'Update laminate details and images' : 'Add a new laminate option'}
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
                    Brand *
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => handleChange('brand', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Wilsonart, Formica"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Pattern Name *
                  </label>
                  <input
                    type="text"
                    value={formData.pattern_name}
                    onChange={(e) => handleChange('pattern_name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Charcoal Slate"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Pattern Code
                  </label>
                  <input
                    type="text"
                    value={formData.pattern_code}
                    onChange={(e) => handleChange('pattern_code', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Manufacturer code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Color Family
                  </label>
                  <input
                    type="text"
                    value={formData.color_family}
                    onChange={(e) => handleChange('color_family', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Woodgrain, Solid, Stone Look"
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
                  placeholder="Description of this laminate pattern"
                />
              </div>
            </div>

            {/* Specifications */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Specifications
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Finish Type
                  </label>
                  <input
                    type="text"
                    value={formData.finish_type}
                    onChange={(e) => handleChange('finish_type', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Matte, Gloss, Textured"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Thickness
                  </label>
                  <input
                    type="text"
                    value={formData.thickness}
                    onChange={(e) => handleChange('thickness', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 0.048 inch"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Grade
                  </label>
                  <input
                    type="text"
                    value={formData.grade}
                    onChange={(e) => handleChange('grade', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., HGS"
                  />
                </div>
              </div>
            </div>

            {/* Supplier Information */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Supplier Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => handleChange('supplier_name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Supplier Website
                  </label>
                  <input
                    type="url"
                    value={formData.supplier_website}
                    onChange={(e) => handleChange('supplier_website', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Supplier Contact
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_contact}
                    onChange={(e) => handleChange('supplier_contact', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
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
                    Swatch Image
                  </label>
                  {formData.swatch_image_url ? (
                    <div className="relative group inline-block">
                      <img 
                        src={resolveImageUrl(formData.swatch_image_url)} 
                        alt="Swatch"
                        className="w-32 h-32 object-cover rounded-lg border border-dark-600"
                      />
                      <button
                        onClick={() => deleteImage('swatch')}
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
                        onChange={(e) => handleImageUpload(e, 'swatch')}
                        className="hidden"
                        disabled={uploadingSwatch}
                      />
                      <div className={`flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingSwatch ? 'opacity-50' : ''}`}>
                        {uploadingSwatch ? (
                          <>
                            <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-2" />
                            <span className="text-sm text-primary-400 font-medium">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-dark-500 mb-2" />
                            <span className="text-xs text-dark-400">Swatch</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Full Image
                  </label>
                  {formData.full_image_url ? (
                    <div className="relative group inline-block">
                      <img 
                        src={resolveImageUrl(formData.full_image_url)} 
                        alt="Full sample"
                        className="w-32 h-32 object-cover rounded-lg border border-dark-600"
                      />
                      <button
                        onClick={() => deleteImage('full')}
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
                        onChange={(e) => handleImageUpload(e, 'full')}
                        className="hidden"
                        disabled={uploadingFullImage}
                      />
                      <div className={`flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingFullImage ? 'opacity-50' : ''}`}>
                        {uploadingFullImage ? (
                          <>
                            <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin mb-2" />
                            <span className="text-sm text-primary-400 font-medium">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-dark-500 mb-2" />
                            <span className="text-xs text-dark-400">Full</span>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Availability & Pricing */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Availability & Pricing
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Lead Time (days)
                  </label>
                  <input
                    type="number"
                    value={formData.lead_time_days}
                    onChange={(e) => handleChange('lead_time_days', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Minimum Order
                  </label>
                  <input
                    type="text"
                    value={formData.minimum_order}
                    onChange={(e) => handleChange('minimum_order', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., 1 sheet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Price per Sheet (cents)
                  </label>
                  <input
                    type="number"
                    value={formData.price_per_sheet}
                    onChange={(e) => handleChange('price_per_sheet', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_in_stock}
                      onChange={(e) => handleChange('is_in_stock', e.target.checked)}
                      className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-sm text-dark-200 font-medium">In Stock</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Additional Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Recommended For
                  </label>
                  <textarea
                    value={formData.recommended_for}
                    onChange={(e) => handleChange('recommended_for', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Which table types this is best for"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Care Instructions
                  </label>
                  <textarea
                    value={formData.care_instructions}
                    onChange={(e) => handleChange('care_instructions', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="Care and maintenance instructions"
                  />
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Display Options
              </h3>
              <div className="grid grid-cols-2 gap-4">
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
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_popular}
                    onChange={(e) => handleChange('is_popular', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Popular</span>
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
            disabled={saving || isUploading}
            className="bg-dark-600 hover:bg-dark-500 text-dark-200 px-6 py-3"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || isUploading || !formData.brand || !formData.pattern_name}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {isUploading ? 'Uploading...' : saving ? 'Saving...' : laminate ? 'Update Laminate' : 'Create Laminate'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LaminateEditor;
