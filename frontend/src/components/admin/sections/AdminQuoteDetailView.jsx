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
  FileText,
  Building2,
  Mail,
  Phone,
  MapPin,
  Package,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { formatPrice } from '../../../utils/apiHelpers';

const AdminQuoteDetailView = ({ quoteId, onBack, onUpdated }) => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  const loadQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get(`/api/v1/admin/quotes/${quoteId}`);
      setQuote(data);
      setFormData({
        status: data.status || 'draft',
        quoted_price: data.quoted_price || null,
        quoted_lead_time: data.quoted_lead_time || '',
        quote_notes: data.quote_notes || '',
        admin_notes: data.admin_notes || '',
        quote_valid_until: data.quote_valid_until || '',
        quote_pdf_url: data.quote_pdf_url || '',
      });
    } catch (err) {
      console.error('Error loading quote:', err);
      setError('Failed to load quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiClient.patch(`/api/v1/admin/quotes/${quoteId}`, formData);
      setIsEditing(false);
      await loadQuote();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error saving quote:', err);
      setError(err.response?.data?.message || 'Failed to save quote. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      status: quote.status || 'draft',
      quoted_price: quote.quoted_price || null,
      quoted_lead_time: quote.quoted_lead_time || '',
      quote_notes: quote.quote_notes || '',
      admin_notes: quote.admin_notes || '',
      quote_valid_until: quote.quote_valid_until || '',
      quote_pdf_url: quote.quote_pdf_url || '',
    });
    setError(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-dark-600', text: 'text-dark-300', icon: FileText },
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-500', icon: Clock },
      approved: { bg: 'bg-green-900/30', text: 'text-green-500', icon: CheckCircle },
      rejected: { bg: 'bg-red-900/30', text: 'text-red-500', icon: XCircle },
      expired: { bg: 'bg-dark-600', text: 'text-dark-400', icon: XCircle },
    };
    
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} flex items-center gap-1.5 w-fit`}>
        <Icon className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return formatPrice(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-dark-600 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="p-8 space-y-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Quotes
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
              <FileText className="w-6 h-6 text-accent-500" />
              Quote #{quote?.quote_number}
            </h2>
            <p className="text-dark-300 mt-1">Quote Details</p>
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

      {/* Quote Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Pricing */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Status & Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Quoted Price (cents)</label>
                    <Input
                      type="number"
                      value={formData.quoted_price || ''}
                      onChange={(e) => setFormData({ ...formData, quoted_price: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Lead Time</label>
                    <Input
                      value={formData.quoted_lead_time}
                      onChange={(e) => setFormData({ ...formData, quoted_lead_time: e.target.value })}
                      placeholder="e.g., 4-6 weeks"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Valid Until</label>
                    <Input
                      type="date"
                      value={formData.quote_valid_until || ''}
                      onChange={(e) => setFormData({ ...formData, quote_valid_until: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Status</p>
                    {getStatusBadge(quote?.status)}
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Quoted Price</p>
                    <p className="text-lg font-semibold text-dark-50">{formatCurrency(quote?.quoted_price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Lead Time</p>
                    <p className="text-dark-50">{quote?.quoted_lead_time || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-1">Valid Until</p>
                    <p className="text-dark-50">{formatDate(quote?.quote_valid_until)}</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Notes</h3>
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Quote Notes</label>
                    <textarea
                      value={formData.quote_notes}
                      onChange={(e) => setFormData({ ...formData, quote_notes: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      placeholder="Notes visible to customer..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Admin Notes</label>
                    <textarea
                      value={formData.admin_notes}
                      onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                      placeholder="Internal admin notes..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-dark-400 mb-2">Quote Notes</p>
                    <p className="text-dark-200 whitespace-pre-wrap">{quote?.quote_notes || 'No notes'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-dark-400 mb-2">Admin Notes</p>
                    <p className="text-dark-200 whitespace-pre-wrap">{quote?.admin_notes || 'No notes'}</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Items */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Quote Items ({quote?.items?.length || 0})
            </h3>
            {quote?.items && quote.items.length > 0 ? (
              <div className="space-y-3">
                {quote.items.map((item, index) => (
                  <div key={item.id || index} className="p-4 bg-dark-700 rounded-lg border border-dark-600">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-dark-50">{item.product_name || item.product_model_number || 'Product'}</p>
                        <p className="text-sm text-dark-400 mt-1">Model: {item.product_model_number || 'N/A'}</p>
                        <p className="text-sm text-dark-300 mt-1">Quantity: {item.quantity || 0}</p>
                        {item.line_total && (
                          <p className="text-sm text-dark-300 mt-1">Line Total: {formatCurrency(item.line_total)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400">No items in this quote</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-400 mb-1">Company Name</p>
                <p className="text-dark-50 font-medium">{quote?.company_name || 'N/A'}</p>
              </div>
              <div className="flex items-center gap-2 text-dark-300">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{quote?.contact_email || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-dark-300">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{quote?.contact_phone || 'N/A'}</span>
              </div>
            </div>
          </Card>

          {/* Shipping Address */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Shipping Address
            </h3>
            <div className="space-y-2 text-sm text-dark-200">
              <p>{quote?.shipping_address_line1 || ''}</p>
              {quote?.shipping_address_line2 && <p>{quote.shipping_address_line2}</p>}
              <p>
                {quote?.shipping_city || ''}, {quote?.shipping_state || ''} {quote?.shipping_zip || ''}
              </p>
              <p>{quote?.shipping_country || 'USA'}</p>
            </div>
          </Card>

          {/* Summary */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Subtotal</span>
                <span className="text-dark-50">{formatCurrency(quote?.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Tax</span>
                <span className="text-dark-50">{formatCurrency(quote?.tax_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Shipping</span>
                <span className="text-dark-50">{formatCurrency(quote?.shipping_cost)}</span>
              </div>
              <div className="border-t border-dark-600 pt-2 flex justify-between font-bold">
                <span className="text-dark-50">Total</span>
                <span className="text-accent-500">{formatCurrency(quote?.total_amount)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminQuoteDetailView;

