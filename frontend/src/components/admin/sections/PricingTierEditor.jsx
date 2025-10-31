import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import apiClient from '../../../config/apiClient';
import { ArrowLeft, DollarSign } from 'lucide-react';

/**
 * Pricing Tier Editor Component
 * 
 * Create/edit pricing tiers with category selection
 */
const PricingTierEditor = ({ tier, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    pricing_tier_name: tier?.pricing_tier_name || '',
    percentage_adjustment: tier?.percentage_adjustment || 0,
    applies_to_all_products: tier?.applies_to_all_products !== false,
    specific_categories: tier?.specific_categories || [],
    effective_from: tier?.effective_from ? tier.effective_from.split('T')[0] : '',
    expires_at: tier?.expires_at ? tier.expires_at.split('T')[0] : '',
    is_active: tier?.is_active !== false,
    admin_notes: tier?.admin_notes || ''
  });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/api/v1/admin/categories');
      setCategories(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryToggle = (categoryId) => {
    setFormData(prev => {
      const current = prev.specific_categories || [];
      const newCategories = current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId];
      return { ...prev, specific_categories: newCategories };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.pricing_tier_name.trim()) {
      alert('Pricing tier name is required');
      return;
    }

    if (formData.percentage_adjustment < -50 || formData.percentage_adjustment > 100) {
      alert('Percentage adjustment must be between -50% and +100%');
      return;
    }

    if (!formData.applies_to_all_products && formData.specific_categories.length === 0) {
      alert('Please select at least one category when scope is set to specific categories');
      return;
    }

    if (formData.effective_from && formData.expires_at) {
      if (new Date(formData.effective_from) > new Date(formData.expires_at)) {
        alert('Effective from date must be before expires at date');
        return;
      }
    }

    setSaving(true);
    
    try {
      const submitData = {
        pricing_tier_name: formData.pricing_tier_name,
        percentage_adjustment: formData.percentage_adjustment,
        applies_to_all_products: formData.applies_to_all_products,
        specific_categories: formData.applies_to_all_products ? null : formData.specific_categories,
        effective_from: formData.effective_from || null,
        expires_at: formData.expires_at || null,
        is_active: formData.is_active,
        admin_notes: formData.admin_notes || null
      };

      if (tier) {
        await apiClient.put(`/api/v1/admin/pricing-tiers/${tier.id}`, submitData);
      } else {
        await apiClient.post('/api/v1/admin/pricing-tiers', submitData);
      }
      
      alert(tier ? 'Pricing tier updated successfully' : 'Pricing tier created successfully');
      onSave();
    } catch (error) {
      console.error('Failed to save pricing tier:', error);
      alert(error.response?.data?.detail || 'Failed to save pricing tier');
    } finally {
      setSaving(false);
    }
  };

  const formatPercentage = (percentage) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage}%`;
  };

  const getPercentageColor = (percentage) => {
    if (percentage > 0) return 'text-green-400';
    if (percentage < 0) return 'text-red-400';
    return 'text-dark-300';
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
            {tier ? `Edit: ${tier.pricing_tier_name}` : 'Create Pricing Tier'}
          </h2>
          <p className="text-dark-300 mt-1">
            {tier ? 'Update pricing tier details' : 'Create a new reusable pricing tier'}
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
                    Tier Name *
                  </label>
                  <input
                    type="text"
                    value={formData.pricing_tier_name}
                    onChange={(e) => handleChange('pricing_tier_name', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                    placeholder="e.g., Gold Tier, Wholesale, Discount"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Percentage Adjustment *
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="-50"
                      max="100"
                      step="1"
                      value={formData.percentage_adjustment}
                      onChange={(e) => handleChange('percentage_adjustment', parseInt(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                      required
                    />
                    <div className={`text-lg font-semibold min-w-[60px] ${getPercentageColor(formData.percentage_adjustment)}`}>
                      {formatPercentage(formData.percentage_adjustment)}
                    </div>
                  </div>
                  <p className="text-xs text-dark-400 mt-1">
                    Range: -50% to +100%. Positive values increase price, negative values decrease.
                  </p>
                </div>
              </div>
            </div>

            {/* Scope Configuration */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Scope Configuration
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={formData.applies_to_all_products}
                    onChange={() => handleChange('applies_to_all_products', true)}
                    className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-dark-50">Apply to All Products</div>
                    <div className="text-xs text-dark-400">This tier will affect pricing for all product categories</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={!formData.applies_to_all_products}
                    onChange={() => handleChange('applies_to_all_products', false)}
                    className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-dark-50">Apply to Specific Categories</div>
                    <div className="text-xs text-dark-400">Select which product categories this tier affects</div>
                  </div>
                </label>

                {!formData.applies_to_all_products && (
                  <div className="ml-7 mt-4 p-4 bg-dark-700 rounded-lg border border-dark-600">
                    {loadingCategories ? (
                      <div className="text-sm text-dark-300">Loading categories...</div>
                    ) : categories.length === 0 ? (
                      <div className="text-sm text-dark-400">No categories available</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-dark-300 mb-2">
                          Selected: {formData.specific_categories.length} category(ies)
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {categories.map((category) => (
                            <label
                              key={category.id}
                              className="flex items-center gap-2 cursor-pointer p-2 hover:bg-dark-600 rounded transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={formData.specific_categories.includes(category.id)}
                                onChange={() => handleCategoryToggle(category.id)}
                                className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                              />
                              <span className="text-sm text-dark-200">{category.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Date Range (Optional)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => handleChange('effective_from', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  />
                  <p className="text-xs text-dark-400 mt-1">
                    Leave empty for no start date restriction
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Expires At
                  </label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => handleChange('expires_at', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  />
                  <p className="text-xs text-dark-400 mt-1">
                    Leave empty for no expiration
                  </p>
                </div>
              </div>
            </div>

            {/* Status & Notes */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4 pb-2 border-b border-dark-600">
                Status & Notes
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="w-4 h-4 text-primary-500 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-dark-50">Active</div>
                    <div className="text-xs text-dark-400">Only active tiers are applied to companies</div>
                  </div>
                </label>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={formData.admin_notes}
                    onChange={(e) => handleChange('admin_notes', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all resize-none"
                    placeholder="Internal notes about this pricing tier..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-dark-600">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-500"
              >
                {saving ? 'Saving...' : (tier ? 'Update Tier' : 'Create Tier')}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default PricingTierEditor;

