import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import apiClient from '../../../config/apiClient';
import {
  ArrowLeft,
  Save,
  Edit2,
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { formatPrice } from '../../../utils/apiHelpers';

const AdminCompanyDetailView = ({ companyId, onBack, onUpdated }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [loadingTiers, setLoadingTiers] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadCompany();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    loadPricingTiers();
  }, []);

  const loadCompany = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get(`/api/v1/admin/companies/${companyId}`);
      setCompany(data);
      setFormData({
        // Company Information
        company_name: data.company_name || '',
        legal_name: data.legal_name || '',
        tax_id: data.tax_id || '',
        industry: data.industry || '',
        website: data.website || '',
        // Primary Contact/Representative
        rep_first_name: data.rep_first_name || '',
        rep_last_name: data.rep_last_name || '',
        rep_title: data.rep_title || '',
        rep_email: data.rep_email || '',
        rep_phone: data.rep_phone || '',
        // Business Address
        billing_address_line1: data.billing_address_line1 || '',
        billing_address_line2: data.billing_address_line2 || '',
        billing_city: data.billing_city || '',
        billing_state: data.billing_state || '',
        billing_zip: data.billing_zip || '',
        billing_country: data.billing_country || 'USA',
        // Shipping Address
        shipping_address_line1: data.shipping_address_line1 || '',
        shipping_address_line2: data.shipping_address_line2 || '',
        shipping_city: data.shipping_city || '',
        shipping_state: data.shipping_state || '',
        shipping_zip: data.shipping_zip || '',
        shipping_country: data.shipping_country || 'USA',
        // Account Status
        status: data.status || 'pending',
        is_verified: data.is_verified || false,
        is_active: data.is_active !== undefined ? data.is_active : true,
        email_verified_at: data.email_verified_at || null,
        // Business Details
        resale_certificate: data.resale_certificate || '',
        credit_limit: data.credit_limit || null,
        payment_terms: data.payment_terms || '',
        // Additional contacts
        additional_contacts: data.additional_contacts || null,
        // Notes
        admin_notes: data.admin_notes || '',
        // Pricing Tier
        pricing_tier_id: data.pricing_tier_id || null,
      });
    } catch (err) {
      console.error('Error loading company:', err);
      setError('Failed to load company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadPricingTiers = async () => {
    try {
      setLoadingTiers(true);
      const response = await apiClient.get('/api/v1/admin/pricing-tiers', {
        params: { include_inactive: false }
      });
      setPricingTiers(response.items || []);
    } catch (error) {
      console.error('Failed to load pricing tiers:', error);
    } finally {
      setLoadingTiers(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiClient.patch(`/api/v1/admin/companies/${companyId}`, formData);
      setIsEditing(false);
      await loadCompany();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error saving company:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to save company. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (company) {
      setFormData({
        company_name: company.company_name || '',
        legal_name: company.legal_name || '',
        tax_id: company.tax_id || '',
        industry: company.industry || '',
        website: company.website || '',
        rep_first_name: company.rep_first_name || '',
        rep_last_name: company.rep_last_name || '',
        rep_title: company.rep_title || '',
        rep_email: company.rep_email || '',
        rep_phone: company.rep_phone || '',
        billing_address_line1: company.billing_address_line1 || '',
        billing_address_line2: company.billing_address_line2 || '',
        billing_city: company.billing_city || '',
        billing_state: company.billing_state || '',
        billing_zip: company.billing_zip || '',
        billing_country: company.billing_country || 'USA',
        shipping_address_line1: company.shipping_address_line1 || '',
        shipping_address_line2: company.shipping_address_line2 || '',
        shipping_city: company.shipping_city || '',
        shipping_state: company.shipping_state || '',
        shipping_zip: company.shipping_zip || '',
        shipping_country: company.shipping_country || 'USA',
        status: company.status || 'pending',
        is_verified: company.is_verified || false,
        is_active: company.is_active !== undefined ? company.is_active : true,
        email_verified_at: company.email_verified_at || null,
        resale_certificate: company.resale_certificate || '',
        credit_limit: company.credit_limit || null,
        payment_terms: company.payment_terms || '',
        additional_contacts: company.additional_contacts || null,
        admin_notes: company.admin_notes || '',
        pricing_tier_id: company.pricing_tier_id || null,
      });
    }
    setError(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-500', icon: Clock, label: 'Pending' },
      active: { bg: 'bg-green-900/30', text: 'text-green-500', icon: CheckCircle, label: 'Active' },
      suspended: { bg: 'bg-red-900/30', text: 'text-red-500', icon: XCircle, label: 'Suspended' },
      inactive: { bg: 'bg-dark-600', text: 'text-dark-400', icon: XCircle, label: 'Inactive' },
    };
    
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} flex items-center gap-1.5 w-fit`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return formatPrice(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-dark-600 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="p-8 space-y-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </Button>
        <Card>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500">{error}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-dark-50 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-accent-500" />
              {company?.company_name || 'Company'}
            </h2>
            <p className="text-dark-300 mt-1">Company Details</p>
          </div>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel} className="flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Card>
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500">{error}</p>
          </div>
        </Card>
      )}

      {/* Company Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Company Name *</label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Company Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Legal Name</label>
                    <Input
                      value={formData.legal_name || ''}
                      onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                      placeholder="Legal Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Tax ID</label>
                    <Input
                      value={formData.tax_id || ''}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      placeholder="Tax ID / EIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Industry</label>
                    <Input
                      value={formData.industry || ''}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder="Industry"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-dark-300 mb-2">Website</label>
                    <Input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Company Name</p>
                    <p className="text-dark-50 font-medium">{company?.company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Legal Name</p>
                    <p className="text-dark-50">{company?.legal_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Tax ID</p>
                    <p className="text-dark-50">{company?.tax_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Industry</p>
                    <p className="text-dark-50">{company?.industry || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-dark-400 mb-1">Website</p>
                    <p className="text-dark-50">
                      {company?.website ? (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline">
                          {company.website}
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Primary Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">First Name *</label>
                    <Input
                      value={formData.rep_first_name}
                      onChange={(e) => setFormData({ ...formData, rep_first_name: e.target.value })}
                      placeholder="First Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Last Name *</label>
                    <Input
                      value={formData.rep_last_name}
                      onChange={(e) => setFormData({ ...formData, rep_last_name: e.target.value })}
                      placeholder="Last Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Title</label>
                    <Input
                      value={formData.rep_title || ''}
                      onChange={(e) => setFormData({ ...formData, rep_title: e.target.value })}
                      placeholder="Job Title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Email *</label>
                    <Input
                      type="email"
                      value={formData.rep_email}
                      onChange={(e) => setFormData({ ...formData, rep_email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-dark-300 mb-2">Phone *</label>
                    <Input
                      type="tel"
                      value={formData.rep_phone}
                      onChange={(e) => setFormData({ ...formData, rep_phone: e.target.value })}
                      placeholder="Phone Number"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Name</p>
                    <p className="text-dark-50 font-medium">
                      {company?.rep_first_name} {company?.rep_last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Title</p>
                    <p className="text-dark-50">{company?.rep_title || 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-dark-400" />
                    <span className="text-sm text-dark-50">{company?.rep_email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-dark-400" />
                    <span className="text-sm text-dark-50">{company?.rep_phone || 'N/A'}</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Billing Address */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Billing Address
            </h3>
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  placeholder="Address Line 1"
                  value={formData.billing_address_line1 || ''}
                  onChange={(e) => setFormData({ ...formData, billing_address_line1: e.target.value })}
                />
                <Input
                  placeholder="Address Line 2 (optional)"
                  value={formData.billing_address_line2 || ''}
                  onChange={(e) => setFormData({ ...formData, billing_address_line2: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="City"
                    value={formData.billing_city || ''}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                  />
                  <Input
                    placeholder="State"
                    value={formData.billing_state || ''}
                    onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="ZIP"
                    value={formData.billing_zip || ''}
                    onChange={(e) => setFormData({ ...formData, billing_zip: e.target.value })}
                  />
                  <Input
                    placeholder="Country"
                    value={formData.billing_country || 'USA'}
                    onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-dark-200">
                <p>{company?.billing_address_line1 || ''}</p>
                {company?.billing_address_line2 && <p>{company.billing_address_line2}</p>}
                <p>
                  {company?.billing_city || ''}, {company?.billing_state || ''} {company?.billing_zip || ''}
                </p>
                <p>{company?.billing_country || 'USA'}</p>
              </div>
            )}
          </Card>

          {/* Shipping Address */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Shipping Address
            </h3>
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  placeholder="Address Line 1"
                  value={formData.shipping_address_line1 || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_address_line1: e.target.value })}
                />
                <Input
                  placeholder="Address Line 2 (optional)"
                  value={formData.shipping_address_line2 || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_address_line2: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="City"
                    value={formData.shipping_city || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                  />
                  <Input
                    placeholder="State"
                    value={formData.shipping_state || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="ZIP"
                    value={formData.shipping_zip || ''}
                    onChange={(e) => setFormData({ ...formData, shipping_zip: e.target.value })}
                  />
                  <Input
                    placeholder="Country"
                    value={formData.shipping_country || 'USA'}
                    onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-dark-200">
                {company?.shipping_address_line1 ? (
                  <>
                    <p>{company.shipping_address_line1}</p>
                    {company.shipping_address_line2 && <p>{company.shipping_address_line2}</p>}
                    <p>
                      {company.shipping_city || ''}, {company.shipping_state || ''} {company.shipping_zip || ''}
                    </p>
                    <p>{company.shipping_country || 'USA'}</p>
                  </>
                ) : (
                  <p className="text-dark-400">Same as billing address</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Status */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Account Status</h3>
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_verified"
                      checked={formData.is_verified || false}
                      onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-accent-500 focus:ring-accent-500"
                    />
                    <label htmlFor="is_verified" className="text-sm text-dark-300">Verified</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active !== undefined ? formData.is_active : true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-accent-500 focus:ring-accent-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-dark-300">Active</label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Status</p>
                    {getStatusBadge(company?.status)}
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Email Verified</p>
                    {company?.is_verified ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-green-500 font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-500 font-medium">Not Verified</span>
                      </div>
                    )}
                    {company?.email_verified_at && (
                      <p className="text-xs text-dark-400 mt-1">
                        Verified: {new Date(company.email_verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Active</p>
                    <p className="text-dark-50">{company?.is_active ? 'Yes' : 'No'}</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Business Details */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Business Details
            </h3>
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Pricing Tier</label>
                    <select
                      value={formData.pricing_tier_id || ''}
                      onChange={(e) => setFormData({ ...formData, pricing_tier_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      disabled={loadingTiers}
                    >
                      <option value="">Default Pricing (No Tier)</option>
                      {pricingTiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.pricing_tier_name} ({tier.percentage_adjustment >= 0 ? '+' : ''}{tier.percentage_adjustment}%)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-dark-400 mt-1">
                      Companies without a tier see default pricing (MSRP)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Resale Certificate</label>
                    <Input
                      value={formData.resale_certificate || ''}
                      onChange={(e) => setFormData({ ...formData, resale_certificate: e.target.value })}
                      placeholder="Resale Certificate Number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Credit Limit (cents)</label>
                    <Input
                      type="number"
                      value={formData.credit_limit || ''}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Payment Terms</label>
                    <Input
                      value={formData.payment_terms || ''}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      placeholder="e.g., Net 30"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Pricing Tier</p>
                    {company?.pricing_tier_id ? (
                      <div>
                        {(() => {
                          const tier = pricingTiers.find(t => t.id === company.pricing_tier_id);
                          return tier ? (
                            <div>
                              <p className="text-dark-50 font-medium">{tier.pricing_tier_name}</p>
                              <p className="text-xs text-dark-400">
                                {tier.percentage_adjustment >= 0 ? '+' : ''}{tier.percentage_adjustment}% adjustment
                                {!tier.applies_to_all_products && tier.specific_categories && (
                                  <span> • {tier.specific_categories.length} categories</span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="text-dark-400">Loading tier info...</p>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-dark-50">Default Pricing (No Tier)</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Resale Certificate</p>
                    <p className="text-dark-50">{company?.resale_certificate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Credit Limit</p>
                    <p className="text-dark-50">{formatCurrency(company?.credit_limit)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Payment Terms</p>
                    <p className="text-dark-50">{company?.payment_terms || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Admin Notes */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Admin Notes</h3>
            {isEditing ? (
              <textarea
                value={formData.admin_notes || ''}
                onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="Internal admin notes..."
              />
            ) : (
              <p className="text-dark-200 whitespace-pre-wrap">{company?.admin_notes || 'No notes'}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminCompanyDetailView;

