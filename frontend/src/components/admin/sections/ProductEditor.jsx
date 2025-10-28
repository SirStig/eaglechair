import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import axios from 'axios';

/**
 * Comprehensive Product Editor
 * 
 * Full product editing with tabs for:
 * - Basic Info
 * - Pricing
 * - Dimensions
 * - Images
 * - Variations
 * - Options
 * - SEO
 */
const ProductEditor = ({ product, onBack }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    model_number: '',
    slug: '',
    category_id: null,
    subcategory_id: null,
    family_id: null,
    short_description: '',
    full_description: '',
    base_price: 0,
    ...product
  });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);

  useEffect(() => {
    fetchCategories();
    fetchFamilies();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/v1/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await axios.get('/api/v1/admin/families');
      setFamilies(response.data || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (product?._isNew) {
        await axios.post('/api/v1/admin/products', formData);
      } else {
        await axios.patch(`/api/v1/admin/products/${product.id}`, formData);
      }
      alert('Product saved successfully!');
      onBack();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '📝' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'dimensions', label: 'Dimensions', icon: '📏' },
    { id: 'images', label: 'Images', icon: '🖼️' },
    { id: 'variations', label: 'Variations', icon: '🔄' },
    { id: 'options', label: 'Options', icon: '⚙️' },
    { id: 'seo', label: 'SEO', icon: '🔍' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Alpine Dining Chair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Model Number *
                </label>
                <input
                  type="text"
                  value={formData.model_number}
                  onChange={(e) => handleChange('model_number', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., 6246"
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
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="alpine-dining-chair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => handleChange('category_id', parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Product Family
                </label>
                <select
                  value={formData.family_id || ''}
                  onChange={(e) => handleChange('family_id', parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="">No Family</option>
                  {families.map(family => (
                    <option key={family.id} value={family.id}>{family.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Short Description
              </label>
              <textarea
                value={formData.short_description || ''}
                onChange={(e) => handleChange('short_description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Brief product description for catalog listings"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Full Description
              </label>
              <textarea
                value={formData.full_description || ''}
                onChange={(e) => handleChange('full_description', e.target.value)}
                rows={8}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Detailed product description"
              />
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Base Price (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData.base_price || 0) / 100}
                    onChange={(e) => handleChange('base_price', Math.round(parseFloat(e.target.value) * 100))}
                    className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  MSRP (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(formData.msrp || 0) / 100}
                    onChange={(e) => handleChange('msrp', Math.round(parseFloat(e.target.value) * 100))}
                    className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <Card className="bg-dark-800 border-dark-600">
              <h4 className="font-medium text-dark-50 mb-2">Pricing Notes</h4>
              <p className="text-sm text-dark-300">
                Base price is the standard price before customizations. MSRP is optional for reference.
                Prices are stored in cents to avoid floating point issues.
              </p>
            </Card>
          </div>
        );

      case 'dimensions':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-dark-50">Product Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.width || ''}
                  onChange={(e) => handleChange('width', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.depth || ''}
                  onChange={(e) => handleChange('depth', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.height || ''}
                  onChange={(e) => handleChange('height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-dark-50 pt-4">Seat Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_width || ''}
                  onChange={(e) => handleChange('seat_width', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_depth || ''}
                  onChange={(e) => handleChange('seat_depth', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Seat Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.seat_height || ''}
                  onChange={(e) => handleChange('seat_height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-dark-50 pt-4">Weight</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight || ''}
                  onChange={(e) => handleChange('weight', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Shipping Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.shipping_weight || ''}
                  onChange={(e) => handleChange('shipping_weight', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>
        );

      case 'images':
        return (
          <div className="space-y-6">
            <p className="text-dark-300">Image upload functionality - to be implemented</p>
            <Button>Upload Images</Button>
          </div>
        );

      case 'variations':
        return (
          <div className="space-y-6">
            <p className="text-dark-300">Product variations management - to be implemented</p>
          </div>
        );

      case 'options':
        return (
          <div className="space-y-6">
            <p className="text-dark-300">Product options and features - to be implemented</p>
          </div>
        );

      case 'seo':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.meta_title || ''}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="SEO optimized title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Meta Description
              </label>
              <textarea
                value={formData.meta_description || ''}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="SEO optimized description"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-dark-50">
              {product?._isNew ? 'Add New Product' : 'Edit Product'}
            </h2>
            <p className="text-dark-300 mt-1">
              {product?._isNew ? 'Create a new product' : `Editing: ${product?.name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="bg-dark-800">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-6 py-3 font-medium transition-all whitespace-nowrap flex items-center gap-2
                ${activeTab === tab.id
                  ? 'bg-primary-900 border border-primary-500 text-primary-500 rounded-lg'
                  : 'text-dark-300 hover:text-dark-50 hover:bg-dark-700 rounded-lg'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      <Card>
        {renderTabContent()}
      </Card>
    </div>
  );
};

export default ProductEditor;
