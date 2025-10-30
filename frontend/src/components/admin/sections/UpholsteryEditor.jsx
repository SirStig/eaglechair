import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { ArrowLeft, Upload, X } from 'lucide-react';

/**
 * Upholstery Editor Component
 * Separate component for editing/creating upholstery options with color, grade, and pricing
 */
const UpholsteryEditor = ({ upholstery, onBack, onSave }) => {
  const [colors, setColors] = useState([]);
  const [formData, setFormData] = useState({
    name: upholstery?.name || '',
    material_code: upholstery?.material_code || '',
    description: upholstery?.description || '',
    material_type: upholstery?.material_type || '',
    grade: upholstery?.grade || '',
    color_id: upholstery?.color_id || null,
    pattern: upholstery?.pattern || '',
    texture_description: upholstery?.texture_description || '',
    swatch_image_url: upholstery?.swatch_image_url || '',
    is_com: upholstery?.is_com || false,
    com_requirements: upholstery?.com_requirements || '',
    durability_rating: upholstery?.durability_rating || '',
    flame_rating: upholstery?.flame_rating || '',
    cleanability: upholstery?.cleanability || '',
    grade_a_cost: upholstery?.grade_a_cost || 0,
    grade_b_cost: upholstery?.grade_b_cost || 0,
    grade_c_cost: upholstery?.grade_c_cost || 0,
    premium_cost: upholstery?.premium_cost || 0,
    is_seat_option_only: upholstery?.is_seat_option_only || false,
    display_order: upholstery?.display_order || 0,
    is_active: upholstery?.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/colors', { params: { is_active: true } });
      setColors(response);
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
      formDataUpload.append('subfolder', 'upholstery');
      
      const response = await apiClient.post('/api/v1/admin/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = response.url;
      handleChange('swatch_image_url', imageUrl);
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
      if (formData.swatch_image_url) {
        await apiClient.delete('/api/v1/admin/upload/image', {
          data: { url: formData.swatch_image_url }
        });
      }
      handleChange('swatch_image_url', '');
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (upholstery) {
        await apiClient.put(`/api/v1/admin/upholsteries/${upholstery.id}`, formData);
      } else {
        await apiClient.post('/api/v1/admin/upholsteries', formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save upholstery:', error);
      alert(error.response?.data?.detail || 'Failed to save upholstery');
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
            {upholstery ? `Edit: ${upholstery.name}` : 'Create Upholstery'}
          </h2>
          <p className="text-dark-300 mt-1">
            {upholstery ? 'Update upholstery details and swatch' : 'Add a new upholstery option'}
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
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Premium Leather Black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Material Code
                  </label>
                  <input
                    type="text"
                    value={formData.material_code}
                    onChange={(e) => handleChange('material_code', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="LTH-BLK-001"
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
                  placeholder="Brief description of this upholstery material"
                />
              </div>
            </div>

            {/* Material Type & Grade */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Type & Grade
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Material Type
                  </label>
                  <select
                    value={formData.material_type}
                    onChange={(e) => handleChange('material_type', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">Select type</option>
                    <option value="Vinyl">Vinyl</option>
                    <option value="Fabric">Fabric</option>
                    <option value="Leather">Leather</option>
                    <option value="Faux Leather">Faux Leather</option>
                    <option value="Mesh">Mesh</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Grade
                  </label>
                  <select
                    value={formData.grade}
                    onChange={(e) => handleChange('grade', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  >
                    <option value="">Select grade</option>
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                    <option value="Premium">Premium</option>
                    <option value="Luxury">Luxury</option>
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
                </div>
              </div>
            </div>

            {/* Pattern & Texture */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Pattern & Texture
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Pattern
                  </label>
                  <input
                    type="text"
                    value={formData.pattern}
                    onChange={(e) => handleChange('pattern', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Solid, Striped, Geometric"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Texture Description
                  </label>
                  <input
                    type="text"
                    value={formData.texture_description}
                    onChange={(e) => handleChange('texture_description', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Smooth, Textured, Pebbled"
                  />
                </div>
              </div>
            </div>

            {/* Swatch Image */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Material Swatch
              </h3>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Swatch Image
                </label>
                {formData.swatch_image_url ? (
                  <div className="relative group inline-block">
                    <img 
                      src={resolveImageUrl(formData.swatch_image_url)} 
                      alt="Material swatch"
                      className="w-48 h-32 object-cover rounded-lg border border-dark-600"
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
                    <div className={`flex flex-col items-center justify-center w-48 h-32 border-2 border-dashed border-dark-600 hover:border-primary-500 rounded-lg cursor-pointer transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
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
              </div>
            </div>

            {/* COM (Customer's Own Material) */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                COM Settings
              </h3>
              <div>
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors w-fit mb-4">
                  <input
                    type="checkbox"
                    checked={formData.is_com}
                    onChange={(e) => handleChange('is_com', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Customer's Own Material (COM)</span>
                </label>
                {formData.is_com && (
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      COM Requirements
                    </label>
                    <textarea
                      value={formData.com_requirements}
                      onChange={(e) => handleChange('com_requirements', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                      placeholder="Specify yardage requirements, pattern matching, etc."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Ratings */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Performance Ratings
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Durability Rating
                  </label>
                  <input
                    type="text"
                    value={formData.durability_rating}
                    onChange={(e) => handleChange('durability_rating', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-principal-500 outline-none transition-all"
                    placeholder="e.g., Heavy Duty, 100k cycles"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Flame Rating
                  </label>
                  <input
                    type="text"
                    value={formData.flame_rating}
                    onChange={(e) => handleChange('flame_rating', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., CAL 117, NFPA 260"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Cleanability
                  </label>
                  <input
                    type="text"
                    value={formData.cleanability}
                    onChange={(e) => handleChange('cleanability', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Easy, Moderate, Professional Only"
                  />
                </div>
              </div>
            </div>

            {/* Grade-Based Pricing */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Grade-Based Pricing (cents)
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Grade A Cost
                  </label>
                  <input
                    type="number"
                    value={formData.grade_a_cost}
                    onChange={(e) => handleChange('grade_a_cost', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Grade B Cost
                  </label>
                  <input
                    type="number"
                    value={formData.grade_b_cost}
                    onChange={(e) => handleChange('grade_b_cost', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Grade C Cost
                  </label>
                  <input
                    type="number"
                    value={formData.grade_c_cost}
                    onChange={(e) => handleChange('grade_c_cost', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Premium Cost
                  </label>
                  <input
                    type="number"
                    value={formData.premium_cost}
                    onChange={(e) => handleChange('premium_cost', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Additional Settings */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Additional Settings
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
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

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg cursor-pointer hover:border-dark-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_seat_option_only}
                    onChange={(e) => handleChange('is_seat_option_only', e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200 font-medium">Seat Option Only</span>
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
            {saving ? 'Saving...' : upholstery ? 'Update Upholstery' : 'Create Upholstery'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UpholsteryEditor;
