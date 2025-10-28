import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';

/**
 * Product Family Management with Full CRUD
 */
const FamilyManagement = () => {
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category_id: null,
    subcategory_id: null,
    family_image: '',
    banner_image_url: '',
    overview_text: '',
    display_order: 0,
    is_active: true,
    is_featured: false
  });
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    fetchFamilies();
    fetchCategories();
  }, [filterCategory, filterActive]);

  const fetchFamilies = async () => {
    try {
      const params = {};
      if (filterCategory) params.category_id = filterCategory;
      if (filterActive !== 'all') params.is_active = filterActive === 'active';
      
      const response = await axios.get('/api/v1/admin/catalog/families', { params });
      setFamilies(response.data || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/v1/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      category_id: null,
      subcategory_id: null,
      family_image: '',
      banner_image_url: '',
      overview_text: '',
      display_order: 0,
      is_active: true,
      is_featured: false
    });
    setEditingFamily(null);
    setShowModal(true);
  };

  const handleEdit = (family) => {
    setFormData({
      name: family.name || '',
      slug: family.slug || '',
      description: family.description || '',
      category_id: family.category_id || null,
      subcategory_id: family.subcategory_id || null,
      family_image: family.family_image || '',
      banner_image_url: family.banner_image_url || '',
      overview_text: family.overview_text || '',
      display_order: family.display_order || 0,
      is_active: family.is_active !== false,
      is_featured: family.is_featured === true
    });
    setEditingFamily(family);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingFamily) {
        await axios.put(`/api/v1/admin/catalog/families/${editingFamily.id}`, formData);
      } else {
        await axios.post('/api/v1/admin/catalog/families', formData);
      }
      setShowModal(false);
      fetchFamilies();
    } catch (error) {
      console.error('Failed to save family:', error);
      alert(error.response?.data?.detail || 'Failed to save family');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (familyId) => {
    if (!confirm('Are you sure you want to delete this family?')) return;
    
    try {
      await axios.delete(`/api/v1/admin/catalog/families/${familyId}`);
      fetchFamilies();
    } catch (error) {
      console.error('Failed to delete family:', error);
      alert(error.response?.data?.detail || 'Failed to delete family');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'N/A';
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Product Family Management</h2>
          <p className="text-dark-300 mt-1">
            Manage product families and collections
          </p>
        </div>
        <Button onClick={handleCreate}>
          + Add Family
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
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

      {/* Family List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : families.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            No families found. Create your first product family.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map((family) => (
              <div
                key={family.id}
                className="bg-dark-700 rounded-lg overflow-hidden hover:bg-dark-600 transition-colors border border-dark-600"
              >
                {family.family_image && (
                  <img
                    src={family.family_image}
                    alt={family.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-dark-50">{family.name}</h3>
                      <p className="text-xs text-dark-400 font-mono mt-1">/{family.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      {family.is_featured && (
                        <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-400 text-xs rounded">
                          Featured
                        </span>
                      )}
                      {!family.is_active && (
                        <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {family.description && (
                    <p className="text-sm text-dark-300 mb-3 line-clamp-2">{family.description}</p>
                  )}
                  
                  <div className="text-xs text-dark-400 mb-3">
                    <div>Category: {getCategoryName(family.category_id)}</div>
                    <div>Order: {family.display_order}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(family)}
                      className="flex-1 px-3 py-1.5 text-sm text-primary-500 hover:bg-primary-900/20 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(family.id)}
                      className="flex-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded transition-colors"
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
                    {editingFamily ? 'Edit Product Family' : 'Create Product Family'}
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Family Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Executive Series"
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
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                        placeholder="executive-series"
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
                      rows={3}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Overview Text
                    </label>
                    <textarea
                      value={formData.overview_text}
                      onChange={(e) => handleChange('overview_text', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Detailed overview for the family page"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Category
                      </label>
                      <select
                        value={formData.category_id || ''}
                        onChange={(e) => handleChange('category_id', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">None</option>
                        {categories.map((cat) => (
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
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Family Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.family_image}
                      onChange={(e) => handleChange('family_image', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="https://..."
                    />
                    {formData.family_image && (
                      <img src={formData.family_image} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Banner Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.banner_image_url}
                      onChange={(e) => handleChange('banner_image_url', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="https://..."
                    />
                    {formData.banner_image_url && (
                      <img src={formData.banner_image_url} alt="Banner" className="mt-2 w-full h-20 object-cover rounded" />
                    )}
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => handleChange('is_active', e.target.checked)}
                        className="w-5 h-5 rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-dark-200">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => handleChange('is_featured', e.target.checked)}
                        className="w-5 h-5 rounded bg-dark-700 border-dark-600 text-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-dark-200">Featured</span>
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
                    disabled={saving || !formData.name || !formData.slug}
                  >
                    {saving ? 'Saving...' : editingFamily ? 'Update' : 'Create'}
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

export default FamilyManagement;
