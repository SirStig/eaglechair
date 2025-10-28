import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';

/**
 * Category Management with Full CRUD, Subcategories, and Image Upload
 */
const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: null,
    icon_url: '',
    banner_image_url: '',
    meta_title: '',
    meta_description: '',
    display_order: 0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/v1/admin/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent_id: null,
      icon_url: '',
      banner_image_url: '',
      meta_title: '',
      meta_description: '',
      display_order: 0,
      is_active: true
    });
    setEditingCategory(null);
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      parent_id: category.parent_id || null,
      icon_url: category.icon_url || '',
      banner_image_url: category.banner_image_url || '',
      meta_title: category.meta_title || '',
      meta_description: category.meta_description || '',
      display_order: category.display_order || 0,
      is_active: category.is_active !== false
    });
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingCategory) {
        // Update existing
        await axios.put(`/api/v1/admin/categories/${editingCategory.id}`, formData);
      } else {
        // Create new
        await axios.post('/api/v1/admin/categories', formData);
      }
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(error.response?.data?.detail || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await axios.delete(`/api/v1/admin/categories/${categoryId}`);
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(error.response?.data?.detail || 'Failed to delete category');
    }
  };

  const toggleExpand = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-50">Category Management</h2>
          <p className="text-dark-300 mt-1">
            Manage product categories, subcategories, and metadata
          </p>
        </div>
        <Button onClick={handleCreate}>
          + Add Category
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="border border-dark-600 rounded-lg overflow-hidden">
                <div className="p-4 bg-dark-700 hover:bg-dark-600 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {category.subcategories?.length > 0 && (
                        <button
                          onClick={() => toggleExpand(category.id)}
                          className="text-dark-300 hover:text-dark-50 transition-colors"
                        >
                          {expandedCategories.has(category.id) ? '▼' : '▶'}
                        </button>
                      )}
                      {category.icon_url && (
                        <img 
                          src={category.icon_url} 
                          alt={category.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-dark-50">{category.name}</h3>
                          <span className="text-xs text-dark-400 font-mono">/{category.slug}</span>
                          {!category.is_active && (
                            <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-dark-400 mt-1">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-500 mr-2">Order: {category.display_order}</span>
                      <button
                        onClick={() => handleEdit(category)}
                        className="px-3 py-1.5 text-primary-500 hover:bg-primary-900/20 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="px-3 py-1.5 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subcategories */}
                {expandedCategories.has(category.id) && category.subcategories?.length > 0 && (
                  <div className="bg-dark-750 border-t border-dark-600 p-2 pl-12">
                    {category.subcategories.map((subcat) => (
                      <div
                        key={subcat.id}
                        className="p-3 bg-dark-700 rounded mb-2 last:mb-0 hover:bg-dark-650 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {subcat.icon_url && (
                              <img 
                                src={subcat.icon_url} 
                                alt={subcat.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-dark-100">{subcat.name}</span>
                                <span className="text-xs text-dark-500 font-mono">/{subcat.slug}</span>
                                {!subcat.is_active && (
                                  <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              {subcat.description && (
                                <p className="text-xs text-dark-400 mt-0.5">{subcat.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-dark-500 mr-2">Order: {subcat.display_order}</span>
                            <button
                              onClick={() => handleEdit(subcat)}
                              className="px-2 py-1 text-sm text-primary-500 hover:bg-primary-900/20 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(subcat.id)}
                              className="px-2 py-1 text-sm text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => !saving && setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-dark-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-dark-600 sticky top-0 bg-dark-800 z-10">
                  <h3 className="text-xl font-bold text-dark-50">
                    {editingCategory ? 'Edit Category' : 'Create Category'}
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Office Chairs"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Slug (URL-friendly)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleChange('slug', e.target.value)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                      placeholder="Auto-generated from name if left empty"
                    />
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
                      placeholder="Brief description of this category"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Parent Category
                    </label>
                    <select
                      value={formData.parent_id || ''}
                      onChange={(e) => handleChange('parent_id', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">None (Top-level category)</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} disabled={editingCategory?.id === cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Images */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-200 mb-2">
                        Icon URL
                      </label>
                      <input
                        type="text"
                        value={formData.icon_url}
                        onChange={(e) => handleChange('icon_url', e.target.value)}
                        className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="https://..."
                      />
                      {formData.icon_url && (
                        <img src={formData.icon_url} alt="Icon preview" className="mt-2 w-16 h-16 object-cover rounded" />
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
                        <img src={formData.banner_image_url} alt="Banner preview" className="mt-2 w-full h-20 object-cover rounded" />
                      )}
                    </div>
                  </div>

                  {/* SEO Metadata */}
                  <div className="pt-4 border-t border-dark-600">
                    <h4 className="text-sm font-semibold text-dark-200 mb-3">SEO Metadata</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Meta Title
                        </label>
                        <input
                          type="text"
                          value={formData.meta_title}
                          onChange={(e) => handleChange('meta_title', e.target.value)}
                          className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="SEO-optimized title for search engines"
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
                          className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="Brief description for search engine results"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Display Settings */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-600">
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

                    <div className="flex items-end">
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
                    {saving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryManagement;
