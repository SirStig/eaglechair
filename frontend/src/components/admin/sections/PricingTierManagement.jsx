import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import apiClient from '../../../config/apiClient';
import { Edit2, Trash2, DollarSign, Plus, Users } from 'lucide-react';
import PricingTierEditor from './PricingTierEditor';
import { useToast } from '../../../contexts/ToastContext';
import { useAdminRefresh } from '../../../contexts/AdminRefreshContext';

/**
 * Pricing Tier Management Component
 * 
 * Manages reusable pricing tiers that can be assigned to companies
 */
const PricingTierManagement = () => {
  const toast = useToast();
  const { refreshKeys } = useAdminRefresh();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, [includeInactive, refreshKeys['pricing-tiers']]);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/admin/pricing-tiers', {
        params: { include_inactive: includeInactive }
      });
      setTiers(response.items || []);
    } catch (error) {
      console.error('Failed to fetch pricing tiers:', error);
      alert(error.response?.data?.detail || 'Failed to fetch pricing tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tier) => {
    setEditingTier(tier);
  };

  const handleCreate = () => {
    setEditingTier({});
  };

  const handleBack = () => {
    setEditingTier(null);
  };

  const handleSave = () => {
    setEditingTier(null);
    toast.success(editingTier?.id ? 'Pricing tier updated' : 'Pricing tier created');
    fetchTiers();
  };

  const handleDelete = async (tierId, tierName) => {
    if (!confirm(`Are you sure you want to delete the pricing tier "${tierName}"? This will unassign it from all companies.`)) {
      return;
    }
    
    try {
      await apiClient.delete(`/api/v1/admin/pricing-tiers/${tierId}`);
      toast.success('Pricing tier deleted');
      await fetchTiers();
    } catch (error) {
      console.error('Failed to delete pricing tier:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete pricing tier');
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

  // Show editor if editing/creating
  if (editingTier !== null) {
    return (
      <PricingTierEditor
        tier={editingTier.id ? editingTier : null}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-dark-50">Pricing Tier Management</h2>
          <p className="text-dark-300 mt-2">
            Create and manage reusable pricing tiers that can be assigned to companies
          </p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-primary-600 hover:bg-primary-500 px-6 py-3"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Tier
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-dark-800 border-dark-700">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-primary-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-dark-50 mb-1">About Pricing Tiers</h3>
            <p className="text-sm text-dark-300">
              Pricing tiers allow you to apply percentage adjustments to product prices for specific companies. 
              Companies without a tier see default pricing (MSRP). Tiers can apply to all products or specific categories.
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="bg-dark-800 border-dark-700">
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500"
            />
            <span className="text-sm text-dark-200">Include inactive tiers</span>
          </label>
        </div>
      </Card>

      {/* Tiers Table */}
      {loading ? (
        <Card className="bg-dark-800 border-dark-700 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="text-dark-300 mt-4">Loading pricing tiers...</p>
        </Card>
      ) : tiers.length === 0 ? (
        <Card className="bg-dark-800 border-dark-700 p-12 text-center">
          <DollarSign className="w-16 h-16 text-dark-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-50 mb-2">No Pricing Tiers</h3>
          <p className="text-dark-300 mb-6">
            Create your first pricing tier to start customizing company pricing
          </p>
          <Button onClick={handleCreate}>
            Create First Tier
          </Button>
        </Card>
      ) : (
        <Card className="bg-dark-800 border-dark-700 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-dark-700 border-b border-dark-600">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Tier Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Adjustment
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Scope
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-dark-200 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-800 divide-y divide-dark-700">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-dark-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-dark-50">
                        {tier.pricing_tier_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${getPercentageColor(tier.percentage_adjustment)}`}>
                        {formatPercentage(tier.percentage_adjustment)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-dark-300">
                        {tier.applies_to_all_products ? (
                          <Badge variant="primary">All Products</Badge>
                        ) : (
                          <Badge variant="accent">
                            {tier.specific_categories?.length || 0} Categories
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-dark-300">
                        {tier.effective_from || tier.expires_at ? (
                          <div>
                            {tier.effective_from && (
                              <div>From: {new Date(tier.effective_from).toLocaleDateString()}</div>
                            )}
                            {tier.expires_at && (
                              <div>Until: {new Date(tier.expires_at).toLocaleDateString()}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-dark-400">No date restrictions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-dark-300">
                        <Users className="w-4 h-4" />
                        <span>{tier.companies_count || 0} companies</span>
                      </div>
                      {tier.assigned_companies && tier.assigned_companies.length > 0 && (
                        <div className="text-xs text-dark-400 mt-1">
                          {tier.assigned_companies.slice(0, 3).map((c, idx) => (
                            <span key={c.id}>
                              {c.name}
                              {idx < Math.min(2, tier.assigned_companies.length - 1) && ', '}
                            </span>
                          ))}
                          {tier.assigned_companies.length > 3 && (
                            <span>... +{tier.assigned_companies.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tier.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(tier)}
                          className="text-primary-400 hover:text-primary-300 p-2 hover:bg-dark-700 rounded transition-colors"
                          title="Edit tier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tier.id, tier.pricing_tier_name)}
                          className="text-red-400 hover:text-red-300 p-2 hover:bg-dark-700 rounded transition-colors"
                          title="Delete tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PricingTierManagement;

