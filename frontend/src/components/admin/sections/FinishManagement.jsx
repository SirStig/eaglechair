import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';

/**
 * Finish Management with Color Picker and Pricing
 */
const FinishManagement = () => {
  const [finishes, setFinishes] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFinish, setEditingFinish] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    finish_code: '',
    description: '',
    finish_type: '',
    color_id: null,
    color_hex: '',
    image_url: '',
    additional_cost: 0,
    display_order: 0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    fetchFinishes();
    fetchColors();
  }, []);

  useEffect(() => {
    fetchFinishes();
  }, [filterType, filterActive]);

  const fetchFinishes = async () => {
    try {
      const params = {};
      if (filterType) params.finish_type = filterType;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await axios.get('/api/v1/admin/catalog/finishes', { params });
      setFinishes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch finishes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColors = async () => {
    try {
      const response = await axios.get('/api/v1/admin/catalog/colors');
      setColors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      finish_code: '',
      description: '',
      finish_type: '',
      color_id: null,
      color_hex: '',
      image_url: '',
      additional_cost: 0,
      display_order: 0,
      is_active: true
    });
    setEditingFinish(null);
    setShowModal(true);
  };

  const handleEdit = (finish) => {
    setFormData({
      name: finish.name || '',
      finish_code: finish.finish_code || '',
      description: finish.description || '',
      finish_type: finish.finish_type || '',
      color_id: finish.color_id || null,
      color_hex: finish.color_hex || '',
      image_url: finish.image_url || '',
      additional_cost: finish.additional_cost || 0,
      display_order: finish.display_order || 0,
      is_active: finish.is_active !== false
    });
    setEditingFinish(finish);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingFinish) {
        await axios.put(`/api/v1/admin/catalog/finishes/${editingFinish.id}`, formData);
      } else {
        await axios.post('/api/v1/admin/catalog/finishes', formData);
      }
      setShowModal(false);
      fetchFinishes();
    } catch (error) {
      console.error('Failed to save finish:', error);
      alert(error.response?.data?.detail || 'Failed to save finish');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (finishId) => {
    if (!confirm('Are you sure you want to delete this finish?')) return;
    
    try {
      await axios.delete(`/api/v1/admin/catalog/finishes/${finishId}`);
      fetchFinishes();
    } catch (error) {
      console.error('Failed to delete finish:', error);
      alert(error.response?.data?.detail || 'Failed to delete finish');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getColorName = (colorId) => {
    const color = colors.find(c => c.id === colorId);
    return color?.name || 'N/A';
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Finish Management</h2>
          <p className="text-dark-300 mt-1">
            Manage wood and metal finishes with colors and pricing
          </p>
        </div>
        <Button onClick={handleCreate}>
          + Add Finish
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="wood">Wood</option>
              <option value="metal">Metal</option>
              <option value="paint">Paint</option>
              <option value="powder_coat">Powder Coat</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Finish List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : finishes.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            No finishes found. Create your first finish option.
          </div>
        ) : (
          <div className="space-y-2">
            {finishes.map((finish) => (
              <div
                key={finish.id}
                className="p-4 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors border border-dark-600"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Color Preview */}
                    {finish.color_hex && (
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-dark-500"
                        style={{ backgroundColor: finish.color_hex }}
                        title={finish.color_hex}
                      />
                    )}
                    {finish.image_url && (
                      <img
                        src={finish.image_url}
                        alt={finish.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-dark-50">{finish.name}</h3>
                        {finish.finish_code && (
                          <span className="px-2 py-0.5 bg-dark-600 text-dark-300 text-xs rounded font-mono">
                            {finish.finish_code}
                          </span>
                        )}
                        {finish.finish_type && (
                          <span className="px-2 py-0.5 bg-primary-900/30 text-primary-400 text-xs rounded">
                            {finish.finish_type}
                          </span>
                        )}
                        {!finish.is_active && (
                          <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {finish.description && (
                        <p className="text-sm text-dark-400 mt-1">{finish.description}</p>
                      )}
                      <div className="text-xs text-dark-500 mt-1">
                        {finish.color_id && `Color: ${getColorName(finish.color_id)} • `}
                        Additional Cost: ${(finish.additional_cost / 100).toFixed(2)} • 
                        Order: {finish.display_order}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(finish)}
                      className="px-3 py-1.5 text-primary-500 hover:bg-primary-900/20 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(finish.id)}
                      className="px-3 py-1.5 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => !saving && setShowModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-dark-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
                  <h3 className="text-xl font-bold text-dark-50">
                    {editingFinish ? 'Edit Finish' : 'Create Finish'}
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Finish Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Natural Oak"
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
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                        placeholder="OAK-NAT"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Finish Type
                      </label>
                      <select
                        value={formData.finish_type}
                        onChange={(e) => handleChange('finish_type', e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select type</option>
                        <option value="wood">Wood</option>
                        <option value="metal">Metal</option>
                        <option value="paint">Paint</option>
                        <option value="powder_coat">Powder Coat</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Color (Optional)
                      </label>
                      <select
                        value={formData.color_id || ''}
                        onChange={(e) => handleChange('color_id', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">None</option>
                        {colors.map((color) => (
                          <option key={color.id} value={color.id}>{color.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Color Hex (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.color_hex}
                        onChange={(e) => handleChange('color_hex', e.target.value)}
                        className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                        placeholder="#8B4513"
                      />
                      <input
                        type="color"
                        value={formData.color_hex || '#000000'}
                        onChange={(e) => handleChange('color_hex', e.target.value)}
                        className="w-16 h-10 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) => handleChange('image_url', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="https://..."
                    />
                    {formData.image_url && (
                      <img src={formData.image_url} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Additional Cost ($)
                      </label>
                      <input
                        type="number"
                        value={(formData.additional_cost / 100).toFixed(2)}
                        onChange={(e) => handleChange('additional_cost', Math.round(parseFloat(e.target.value) * 100) || 0)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => handleChange('is_active', e.target.checked)}
                        className="w-5 h-5 rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-dark-200">Active</span>
                    </label>
                  </div>
                </div>

                <div className="p-6 border-t border-dark-600 flex justify-end gap-3 sticky bottom-0 bg-dark-800">
                  <Button
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="bg-dark-600 hover:bg-dark-500"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formData.name}
                  >
                    {saving ? 'Saving...' : editingFinish ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinishManagement;
