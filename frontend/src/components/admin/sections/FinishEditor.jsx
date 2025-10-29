import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Finish Editor Component
 * Separate component for editing/creating finishes with image upload
 */
const FinishEditor = ({ finish, onBack, onSave }) => {
  const [colors, setColors] = useState([]);
  const [formData, setFormData] = useState({
    name: finish?.name || '',
    finish_code: finish?.finish_code || '',
    description: finish?.description || '',
    finish_type: finish?.finish_type || '',
    color_id: finish?.color_id || null,
    color_hex: finish?.color_hex || '',
    image_url: finish?.image_url || '',
    additional_cost: finish?.additional_cost || 0,
    is_custom: finish?.is_custom || false,
    is_to_match: finish?.is_to_match || false,
    display_order: finish?.display_order || 0,
    is_active: finish?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      const response = await axios.get('/api/v1/admin/colors', { params: { is_active: true } });
      setColors(response.data);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
    }
  };

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
      formDataUpload.append('subfolder', 'finishes');
      
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
    if (!confirm('Delete this sample image?')) return;
    
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
      if (finish) {
        await axios.put(`/api/v1/admin/finishes/${finish.id}`, formData);
      } else {
        await axios.post('/api/v1/admin/finishes', formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save finish:', error);
      alert(error.response?.data?.detail || 'Failed to save finish');
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
            {finish ? `Edit: ${finish.name}` : 'Create Finish'}
          </h2>
          <p className="text-dark-300 mt-1">
            {finish ? 'Update finish details and sample' : 'Add a new finish option'}
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
                    Finish Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Walnut Stain"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Finish Code
                  </label>
                  <input
                    type="text"
                    value={formData.finish_code}
                    onChange={(e) => handleChange('finish_code', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="WS-001"
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
                  placeholder="Brief description of this finish"
                />
              </div>
            </div>

            {/* Finish Type & Color */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Type & Color
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Finish Type
                  </label>
                  <select
                    value={formData.finish_type}
                    onChange={(e) => handleChange('finish_type', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">Select type</option>
                    <option value="Wood Stain">Wood Stain</option>
                    <option value="Paint">Paint</option>
                    <option value="Metal">Metal</option>
                    <option value="Powder Coat">Powder Coat</option>
                    <option value="Lacquer">Lacquer</option>
                    <option value="Veneer">Veneer</option>
                    <option value="Chrome">Chrome</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Color Reference
                  </label>
                  <select
                    value={formData.color_id || ''}
                    onChange={(e) => handleChange('color_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">No color reference</option>
                    {colors.map((color) => (
                      <option key={color.id} value={color.id}>
                        {color.name} {color.color_code ? `(${color.color_code})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dark-400 mt-1">Optional: Link to color from color library</p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Hex Color (Fallback)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={formData.color_hex}
                    onChange={(e) => handleChange('color_hex', e.target.value)}
                    className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="#8B4513"
                  />
                  <input
                    type="color"
                    value={formData.color_hex || '#000000'}
                    onChange={(e) => handleChange('color_hex', e.target.value)}
                    className="w-16 h-10 rounded-lg border-2 border-dark-600 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-dark-400 mt-1">For backward compatibility or if no color reference</p>
              </div>
            </div>

            {/* Sample Image */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Finish Sample
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Sample Image
                </label>
                {formData.image_url ? (
                  <div className="relative group inline-block">
                    <img 
                      src={formData.image_url} 
                      alt="Finish sample"
                      className="w-48 h-32 object-cover rounded-lg border border-dark-600"
                    />
                    <button
                      onClick={deleteImage}
                      className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                      title="Delete sample"
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
                    <div className={`flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
                      {uploadingImage ? (
                        <div className="w-8 h-8 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-dark-500 mb-2" />
                          <span className="text-sm text-dark-400">Upload sample</span>
                          <span className="text-xs text-dark-500 mt-1">PNG, JPG</span>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Pricing & Flags */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Pricing & Options
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Additional Cost (cents)
                  </label>
                  <input
                    type="number"
                    value={formData.additional_cost}
                    onChange={(e) => handleChange('additional_cost', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                  <p className="text-xs text-dark-400 mt-1">Price added to base product price</p>
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
                    checked={formData.is_custom}
                    onChange={(e) => handleChange('is_custom', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Custom Finish</span>
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_to_match}
                    onChange={(e) => handleChange('is_to_match', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">To Match</span>
                </label>
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
            {saving ? 'Saving...' : finish ? 'Update Finish' : 'Create Finish'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FinishEditor;
