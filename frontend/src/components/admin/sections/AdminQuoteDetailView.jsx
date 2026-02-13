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
  Plus,
  Trash2,
} from 'lucide-react';
import { formatPrice } from '../../../utils/apiHelpers';

const AdminQuoteDetailView = ({ quoteId, onBack, onUpdated }) => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [addingItem, setAddingItem] = useState(false);
  const [formData, setFormData] = useState({});
  const [newItemData, setNewItemData] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    customization_cost: 0,
    selected_finish_id: null,
    selected_upholstery_id: null,
    custom_options: null,
    item_notes: '',
  });
  const [products, setProducts] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (quoteId) {
      loadQuote();
      loadProducts();
      loadFinishes();
      loadUpholsteries();
    }
  }, [quoteId]);

  const loadProducts = async () => {
    try {
      // Load products for adding to quote
      const data = await apiClient.get('/api/v1/admin/products?page=1&page_size=1000');
      setProducts(data.items || []);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const loadFinishes = async () => {
    try {
      const data = await apiClient.get('/api/v1/admin/catalog/finishes?is_active=true');
      setFinishes(data || []);
    } catch (err) {
      console.error('Error loading finishes:', err);
    }
  };

  const loadUpholsteries = async () => {
    try {
      const data = await apiClient.get('/api/v1/admin/catalog/upholsteries?is_active=true');
      setUpholsteries(data || []);
    } catch (err) {
      console.error('Error loading upholsteries:', err);
    }
  };

  const loadQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get(`/api/v1/admin/quotes/${quoteId}`);
      setQuote(data);
      setFormData({
        // Status and pricing
        status: data.status || 'draft',
        quoted_price: data.quoted_price || null,
        quoted_lead_time: data.quoted_lead_time || '',
        quote_notes: data.quote_notes || '',
        admin_notes: data.admin_notes || '',
        quote_valid_until: data.quote_valid_until || '',
        quote_pdf_url: data.quote_pdf_url || '',
        // Contact Information
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        // Project Information
        project_name: data.project_name || '',
        project_description: data.project_description || '',
        project_type: data.project_type || '',
        estimated_quantity: data.estimated_quantity || null,
        target_budget: data.target_budget || null,
        desired_delivery_date: data.desired_delivery_date || '',
        // Shipping Information
        shipping_address_line1: data.shipping_address_line1 || '',
        shipping_address_line2: data.shipping_address_line2 || '',
        shipping_city: data.shipping_city || '',
        shipping_state: data.shipping_state || '',
        shipping_zip: data.shipping_zip || '',
        shipping_country: data.shipping_country || 'USA',
        // Special Requests
        special_instructions: data.special_instructions || '',
        requires_com: data.requires_com || false,
        rush_order: data.rush_order || false,
        // Totals (can be manually adjusted)
        subtotal: data.subtotal || null,
        tax_amount: data.tax_amount || null,
        shipping_cost: data.shipping_cost || null,
        discount_amount: data.discount_amount || null,
        total_amount: data.total_amount || null,
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
    setEditingItemId(null);
    setAddingItem(false);
    setNewItemData({ 
      product_id: '', 
      quantity: 1, 
      unit_price: 0, 
      customization_cost: 0,
      selected_finish_id: null,
      selected_upholstery_id: null,
      custom_options: null,
      item_notes: '',
    });
    if (quote) {
      setFormData({
        status: quote.status || 'draft',
        quoted_price: quote.quoted_price || null,
        quoted_lead_time: quote.quoted_lead_time || '',
        quote_notes: quote.quote_notes || '',
        admin_notes: quote.admin_notes || '',
        quote_valid_until: quote.quote_valid_until || '',
        quote_pdf_url: quote.quote_pdf_url || '',
        contact_name: quote.contact_name || '',
        contact_email: quote.contact_email || '',
        contact_phone: quote.contact_phone || '',
        project_name: quote.project_name || '',
        project_description: quote.project_description || '',
        project_type: quote.project_type || '',
        estimated_quantity: quote.estimated_quantity || null,
        target_budget: quote.target_budget || null,
        desired_delivery_date: quote.desired_delivery_date || '',
        shipping_address_line1: quote.shipping_address_line1 || '',
        shipping_address_line2: quote.shipping_address_line2 || '',
        shipping_city: quote.shipping_city || '',
        shipping_state: quote.shipping_state || '',
        shipping_zip: quote.shipping_zip || '',
        shipping_country: quote.shipping_country || 'USA',
        special_instructions: quote.special_instructions || '',
        requires_com: quote.requires_com || false,
        rush_order: quote.rush_order || false,
        subtotal: quote.subtotal || null,
        tax_amount: quote.tax_amount || null,
        shipping_cost: quote.shipping_cost || null,
        discount_amount: quote.discount_amount || null,
        total_amount: quote.total_amount || null,
      });
    }
    setError(null);
  };

  const handleUpdateItem = async (itemId, itemData) => {
    try {
      setError(null);
      // Prepare data - convert empty strings to null for optional fields
      const updateData = {
        ...itemData,
        selected_finish_id: itemData.selected_finish_id || null,
        selected_upholstery_id: itemData.selected_upholstery_id || null,
        custom_options: itemData.custom_options || null,
        item_notes: itemData.item_notes || null,
      };
      await apiClient.patch(`/api/v1/admin/quotes/${quoteId}/items/${itemId}`, updateData);
      setEditingItemId(null);
      await loadQuote();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err.response?.data?.detail || 'Failed to update item. Please try again.');
    }
  };

  const handleAddItem = async () => {
    try {
      setError(null);
      if (!newItemData.product_id || !newItemData.quantity || newItemData.unit_price === undefined) {
        setError('Please fill in all required fields (product, quantity, unit price)');
        return;
      }
      // Prepare data - convert empty strings to null for optional fields
      const addData = {
        ...newItemData,
        product_id: parseInt(newItemData.product_id),
        quantity: parseInt(newItemData.quantity),
        unit_price: parseInt(newItemData.unit_price) || 0,
        customization_cost: parseInt(newItemData.customization_cost) || 0,
        selected_finish_id: newItemData.selected_finish_id || null,
        selected_upholstery_id: newItemData.selected_upholstery_id || null,
        custom_options: newItemData.custom_options || null,
        item_notes: newItemData.item_notes || null,
      };
      await apiClient.post(`/api/v1/admin/quotes/${quoteId}/items`, addData);
      setAddingItem(false);
      setNewItemData({ 
        product_id: '', 
        quantity: 1, 
        unit_price: 0, 
        customization_cost: 0,
        selected_finish_id: null,
        selected_upholstery_id: null,
        custom_options: null,
        item_notes: '',
      });
      await loadQuote();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err.response?.data?.detail || 'Failed to add item. Please try again.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to remove this item from the quote?')) {
      return;
    }
    try {
      setError(null);
      await apiClient.delete(`/api/v1/admin/quotes/${quoteId}/items/${itemId}`);
      await loadQuote();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.response?.data?.detail || 'Failed to delete item. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-dark-600', text: 'text-dark-300', icon: FileText, label: 'Draft' },
      submitted: { bg: 'bg-blue-900/30', text: 'text-blue-500', icon: Clock, label: 'Submitted' },
      under_review: { bg: 'bg-yellow-900/30', text: 'text-yellow-500', icon: Clock, label: 'Under Review' },
      quoted: { bg: 'bg-accent-900/30', text: 'text-accent-500', icon: DollarSign, label: 'Quoted' },
      accepted: { bg: 'bg-green-900/30', text: 'text-green-500', icon: CheckCircle, label: 'Accepted' },
      declined: { bg: 'bg-red-900/30', text: 'text-red-500', icon: XCircle, label: 'Declined' },
      expired: { bg: 'bg-dark-600', text: 'text-dark-400', icon: XCircle, label: 'Expired' },
    };
    
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} flex items-center gap-1.5 w-fit`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.label || status}
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
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="quoted">Quoted</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-50 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Quote Items ({quote?.items?.length || 0})
              </h3>
              {!addingItem && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingItem(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
              )}
            </div>
            
            {/* Add Item Form */}
            {addingItem && (
              <div className="mb-4 p-4 bg-dark-700 rounded-lg border border-dark-600 space-y-4">
                <h4 className="font-medium text-dark-50 mb-3">Add New Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Product *</label>
                    <select
                      value={newItemData.product_id}
                      onChange={(e) => {
                        const product = products.find(p => p.id === parseInt(e.target.value));
                        setNewItemData({
                          ...newItemData,
                          product_id: e.target.value,
                          unit_price: product?.base_price || 0,
                        });
                      }}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">Select product...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.model_number})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Quantity *</label>
                    <Input
                      type="number"
                      min="1"
                      value={newItemData.quantity}
                      onChange={(e) => setNewItemData({ ...newItemData, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Unit Price (cents) *</label>
                    <Input
                      type="number"
                      min="0"
                      value={newItemData.unit_price}
                      onChange={(e) => setNewItemData({ ...newItemData, unit_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Customization Cost (cents)</label>
                    <Input
                      type="number"
                      min="0"
                      value={newItemData.customization_cost}
                      onChange={(e) => setNewItemData({ ...newItemData, customization_cost: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Selected Finish</label>
                    <select
                      value={newItemData.selected_finish_id || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, selected_finish_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">None</option>
                      {finishes.map((finish) => (
                        <option key={finish.id} value={finish.id}>
                          {finish.name} {finish.finish_code ? `(${finish.finish_code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Selected Upholstery</label>
                    <select
                      value={newItemData.selected_upholstery_id || ''}
                      onChange={(e) => setNewItemData({ ...newItemData, selected_upholstery_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <option value="">None</option>
                      {upholsteries.map((upholstery) => (
                        <option key={upholstery.id} value={upholstery.id}>
                          {upholstery.name} {upholstery.material_type ? `(${upholstery.material_type})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Custom Options (JSON)</label>
                  <textarea
                    value={newItemData.custom_options ? JSON.stringify(newItemData.custom_options, null, 2) : ''}
                    onChange={(e) => {
                      let customOptions = null;
                      try {
                        if (e.target.value.trim()) {
                          customOptions = JSON.parse(e.target.value);
                        }
                      } catch {
                        // Invalid JSON, will be handled on save
                      }
                      setNewItemData({ ...newItemData, custom_options: customOptions });
                    }}
                    rows={4}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder='{"key": "value"}'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Item Notes</label>
                  <textarea
                    value={newItemData.item_notes || ''}
                    onChange={(e) => setNewItemData({ ...newItemData, item_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder="Item-specific notes..."
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={handleAddItem} size="sm">Add Item</Button>
                  <Button variant="outline" onClick={() => { 
                    setAddingItem(false); 
                    setNewItemData({ 
                      product_id: '', 
                      quantity: 1, 
                      unit_price: 0, 
                      customization_cost: 0,
                      selected_finish_id: null,
                      selected_upholstery_id: null,
                      custom_options: null,
                      item_notes: '',
                    }); 
                  }} size="sm">Cancel</Button>
                </div>
              </div>
            )}

            {quote?.items && quote.items.length > 0 ? (
              <div className="space-y-3">
                {quote.items.map((item, index) => (
                  <div key={item.id || index} className="p-4 bg-dark-700 rounded-lg border border-dark-600">
                    {editingItemId === item.id ? (
                      <div className="space-y-4">
                        {/* Product Info (read-only) */}
                        <div className="pb-3 border-b border-dark-600">
                          <p className="font-medium text-dark-50">{item.product_name || item.product_model_number || 'Product'}</p>
                          <p className="text-sm text-dark-400">Model: {item.product_model_number || 'N/A'}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Quantity *</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity || 1}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value) || 1;
                                const updatedItems = quote.items.map(i =>
                                  i.id === item.id ? { ...i, quantity: qty } : i
                                );
                                setQuote({ ...quote, items: updatedItems });
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Unit Price (cents) *</label>
                            <Input
                              type="number"
                              min="0"
                              value={item.unit_price || 0}
                              onChange={(e) => {
                                const price = parseInt(e.target.value) || 0;
                                const updatedItems = quote.items.map(i =>
                                  i.id === item.id ? { ...i, unit_price: price } : i
                                );
                                setQuote({ ...quote, items: updatedItems });
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Customization Cost (cents)</label>
                            <Input
                              type="number"
                              min="0"
                              value={item.customization_cost || 0}
                              onChange={(e) => {
                                const cost = parseInt(e.target.value) || 0;
                                const updatedItems = quote.items.map(i =>
                                  i.id === item.id ? { ...i, customization_cost: cost } : i
                                );
                                setQuote({ ...quote, items: updatedItems });
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Selected Finish</label>
                            <select
                              value={item.selected_finish_id || ''}
                              onChange={(e) => {
                                const finishId = e.target.value ? parseInt(e.target.value) : null;
                                const updatedItems = quote.items.map(i =>
                                  i.id === item.id ? { ...i, selected_finish_id: finishId } : i
                                );
                                setQuote({ ...quote, items: updatedItems });
                              }}
                              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                            >
                              <option value="">None</option>
                              {finishes.map((finish) => (
                                <option key={finish.id} value={finish.id}>
                                  {finish.name} {finish.finish_code ? `(${finish.finish_code})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">Selected Upholstery</label>
                            <select
                              value={item.selected_upholstery_id || ''}
                              onChange={(e) => {
                                const upholsteryId = e.target.value ? parseInt(e.target.value) : null;
                                const updatedItems = quote.items.map(i =>
                                  i.id === item.id ? { ...i, selected_upholstery_id: upholsteryId } : i
                                );
                                setQuote({ ...quote, items: updatedItems });
                              }}
                              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                            >
                              <option value="">None</option>
                              {upholsteries.map((upholstery) => (
                                <option key={upholstery.id} value={upholstery.id}>
                                  {upholstery.name} {upholstery.material_type ? `(${upholstery.material_type})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-dark-300 mb-1">Custom Options (JSON)</label>
                          <textarea
                            value={item.custom_options ? JSON.stringify(item.custom_options, null, 2) : ''}
                            onChange={(e) => {
                              let customOptions = null;
                              try {
                                if (e.target.value.trim()) {
                                  customOptions = JSON.parse(e.target.value);
                                }
                              } catch {
                                // Invalid JSON, keep as is
                              }
                              const updatedItems = quote.items.map(i =>
                                i.id === item.id ? { ...i, custom_options: customOptions } : i
                              );
                              setQuote({ ...quote, items: updatedItems });
                            }}
                            rows={4}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                            placeholder='{"key": "value"}'
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-dark-300 mb-1">Item Notes</label>
                          <textarea
                            value={item.item_notes || ''}
                            onChange={(e) => {
                              const updatedItems = quote.items.map(i =>
                                i.id === item.id ? { ...i, item_notes: e.target.value } : i
                              );
                              setQuote({ ...quote, items: updatedItems });
                            }}
                            rows={3}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                            placeholder="Item-specific notes..."
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const currentItem = quote.items.find(i => i.id === item.id);
                              handleUpdateItem(item.id, {
                                quantity: currentItem.quantity,
                                unit_price: currentItem.unit_price,
                                customization_cost: currentItem.customization_cost || 0,
                                selected_finish_id: currentItem.selected_finish_id || null,
                                selected_upholstery_id: currentItem.selected_upholstery_id || null,
                                custom_options: currentItem.custom_options || null,
                                item_notes: currentItem.item_notes || null,
                              });
                            }}
                          >
                            Save
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setEditingItemId(null); loadQuote(); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            {item.product?.primary_image_url && (
                              <img
                                src={item.product.primary_image_url}
                                alt={item.product_name}
                                className="w-20 h-20 object-cover rounded-md border border-dark-600"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-dark-50 text-lg">{item.product_name || item.product_model_number || 'Product'}</p>
                                  <p className="text-sm text-dark-400 mt-1">Model: {item.product_model_number || 'N/A'}</p>
                                </div>
                              </div>
                              
                              {/* Pricing & Quantity */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div>
                                  <span className="text-dark-400 block mb-1">Quantity</span>
                                  <span className="text-dark-50 font-semibold">{item.quantity || 0}</span>
                                </div>
                                <div>
                                  <span className="text-dark-400 block mb-1">Unit Price</span>
                                  <span className="text-dark-50 font-semibold">{formatCurrency(item.unit_price)}</span>
                                </div>
                                <div>
                                  <span className="text-dark-400 block mb-1">Customization Cost</span>
                                  <span className="text-dark-50 font-semibold">{formatCurrency(item.customization_cost || 0)}</span>
                                </div>
                                <div>
                                  <span className="text-dark-400 block mb-1">Line Total</span>
                                  <span className="text-accent-500 font-bold text-base">{formatCurrency(item.line_total)}</span>
                                </div>
                              </div>
                              {item.allocations && item.allocations.length > 0 && quote?.shipping_destinations?.length > 0 && (
                                <p className="text-sm text-dark-400 mt-2">
                                  Split: {item.allocations.map((a) => {
                                    const dest = quote.shipping_destinations.find((d) => d.id === a.quote_shipping_destination_id);
                                    const label = dest?.label || dest?.line1 || `Dest ${a.quote_shipping_destination_id}`;
                                    return `${a.quantity} → ${label}`;
                                  }).join(', ')}
                                </p>
                              )}

                              {/* Finish & Upholstery */}
                              {(item.selected_finish_id || item.selected_upholstery_id) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-dark-600">
                                  {item.selected_finish_id && (
                                    <div>
                                      <span className="text-dark-400 block text-xs mb-1">Selected Finish</span>
                                      <span className="text-dark-200 text-sm">
                                        {finishes.find(f => f.id === item.selected_finish_id)?.name || `ID: ${item.selected_finish_id}`}
                                      </span>
                                    </div>
                                  )}
                                  {item.selected_upholstery_id && (
                                    <div>
                                      <span className="text-dark-400 block text-xs mb-1">Selected Upholstery</span>
                                      <span className="text-dark-200 text-sm">
                                        {upholsteries.find(u => u.id === item.selected_upholstery_id)?.name || `ID: ${item.selected_upholstery_id}`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Custom Options */}
                              {item.custom_options && (
                                <div className="mt-3 pt-3 border-t border-dark-600">
                                  <span className="text-dark-400 block text-xs mb-1">Custom Options</span>
                                  <pre className="text-xs text-dark-300 bg-dark-800 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(item.custom_options, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {/* Item Notes */}
                              {item.item_notes && (
                                <div className="mt-3 pt-3 border-t border-dark-600">
                                  <span className="text-dark-400 block text-xs mb-1">Item Notes</span>
                                  <p className="text-sm text-dark-200 whitespace-pre-wrap">{item.item_notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="outline" size="sm" onClick={() => setEditingItemId(item.id)} className="flex items-center gap-1">
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-400 flex items-center gap-1">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !addingItem && <p className="text-dark-400">No items in this quote</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company & Contact
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-dark-400 mb-1">Company Name</p>
                <p className="text-dark-50 font-medium">{quote?.company_name || 'N/A'}</p>
              </div>
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Contact Name</label>
                    <Input
                      value={formData.contact_name || ''}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Contact Email</label>
                    <Input
                      type="email"
                      value={formData.contact_email || ''}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Contact Phone</label>
                    <Input
                      type="tel"
                      value={formData.contact_phone || ''}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-dark-300">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{quote?.contact_email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-dark-300">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">{quote?.contact_phone || 'N/A'}</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Shipping Destinations */}
          <Card>
            <h3 className="text-lg font-bold text-dark-50 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {quote?.shipping_destinations?.length > 1 ? 'Shipping Destinations' : 'Shipping Address'}
            </h3>
            <div className="space-y-3">
              {(quote?.shipping_destinations && quote.shipping_destinations.length > 0)
                ? quote.shipping_destinations.map((d) => (
                    <div key={d.id} className="text-sm text-dark-200 p-2 rounded bg-dark-700">
                      {d.label && <p className="font-medium text-dark-100">{d.label}</p>}
                      <p>{d.line1}</p>
                      {d.line2 && <p>{d.line2}</p>}
                      <p>{d.city}, {d.state} {d.zip} {d.country}</p>
                    </div>
                  ))
                : (
                    <div className="space-y-2 text-sm text-dark-200">
                      <p>{quote?.shipping_address_line1 || ''}</p>
                      {quote?.shipping_address_line2 && <p>{quote.shipping_address_line2}</p>}
                      <p>{quote?.shipping_city || ''}, {quote?.shipping_state || ''} {quote?.shipping_zip || ''}</p>
                      <p>{quote?.shipping_country || 'USA'}</p>
                    </div>
                  )}
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

