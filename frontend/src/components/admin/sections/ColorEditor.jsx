import { useState } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Color Editor Component
 * Separate component for editing/creating colors with color picker
 */
const ColorEditor = ({ color, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: color?.name || '',
    color_code: color?.color_code || '',
    hex_value: color?.hex_value || '#000000',
    category: color?.category || '',
    image_url: color?.image_url || '',
    display_order: color?.display_order || 0,
    is_active: color?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('subfolder', 'colors');
      
      const response = await axios.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = response.data.url;
      handleChange('image_url', imageUrl);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async () => {
    if (!confirm('Delete this swatch image?')) return;
    
    try {
      if (formData.image_url) {
        await axios.delete('/api/v1/admin/upload/image', {
          data: { url: formData.image_url }
        });
      }
      handleChange('image_url', '');
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (color) {
        await axios.put(`/api/v1/admin/colors/${color.id}`, formData);
      } else {
        await axios.post('/api/v1/admin/colors', formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save color:', error);
      alert(error.response?.data?.detail || 'Failed to save color');
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
            {color ? `Edit: ${color.name}` : 'Create Color'}
          </h2>
          <p className="text-dark-300 mt-1">
            {color ? 'Update color details and swatch' : 'Add a new color option'}
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
                    Color Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Walnut Brown"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Color Code
                  </label>
                  <input
                    type="text"
                    value={formData.color_code}
                    onChange={(e) => handleChange('color_code', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="WB-001"
                  />
                </div>
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Color Value
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Hex Color
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={formData.hex_value}
                        onChange={(e) => handleChange('hex_value', e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                        placeholder="#A0522D"
                      />
                    </div>
                    <input
                      type="color"
                      value={formData.hex_value || '#000000'}
                      onChange={(e) => handleChange('hex_value', e.target.value)}
                      className="w-16 h-10 rounded-lg border-2 border-dark-600 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-dark-400 mt-1">Click color box to use color picker</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Color Preview
                  </label>
                  <div 
                    className="w-full h-24 rounded-lg border-2 border-dark-600"
                    style={{ backgroundColor: formData.hex_value || '#000000' }}
                  />
                </div>
              </div>
            </div>

            {/* Swatch Image */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Swatch Image (Optional)
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Upload Swatch
                </label>
                {formData.image_url ? (
                  <div className="relative group inline-block">
                    <img 
                      src={formData.image_url} 
                      alt="Color swatch"
                      className="w-32 h-32 object-cover rounded-lg border border-dark-600"
                    />
                    <button
                      onClick={deleteImage}
                      className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                      title="Delete swatch"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="relative block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <div className={`flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
                      {uploadingImage ? (
                        <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-dark-500 mb-2" />
                          <span className="text-sm text-dark-400">Upload swatch</span>
                          <span className="text-xs text-dark-500 mt-1">PNG, JPG</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
                <p className="text-xs text-dark-400 mt-2">
                  Optional: Upload a photo/texture swatch for materials like wood or fabric
                </p>
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
                    Category
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">Select category</option>
                    <option value="wood">Wood</option>
                    <option value="metal">Metal</option>
                    <option value="fabric">Fabric</option>
                    <option value="paint">Paint</option>
                    <option value="leather">Leather</option>
                    <option value="vinyl">Vinyl</option>
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
            disabled={saving || !formData.name}
            className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
          >
            {saving ? 'Saving...' : color ? 'Update Color' : 'Create Color'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ColorEditor;
