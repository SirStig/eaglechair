import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import virtualCatalogService from '../../../services/virtualCatalogService';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import { 
  FileText, 
  DollarSign, 
  Ruler, 
  Image as ImageIcon, 
  Settings, 
  X,
  Plus,
  Trash2,
  ArrowLeft,
  Wrench,
  Award,
  Package,
  Save,
  Upload,
  Edit2
} from 'lucide-react';

/**
 * Comprehensive Virtual Catalog Product Editor
 * 
 * Full product editing with tabs for temporary catalog products:
 * - Basic Info
 * - Pricing & Inventory
 * - Dimensions
 * - Images
 * - Materials & Features
 * - Variations
 * - Certifications & SEO
 */
const VirtualCatalogProductEditor = ({ productId, onBack, onSave }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
  const [formData, setFormData] = useState({
    // Basic Information
    name: '',
    model_number: '',
    model_suffix: '',
    slug: '',
    short_description: '',
    full_description: '',
    
    // Categories
    category_id: null,
    subcategory_id: null,
    family_id: null,
    
    // Pricing
    base_price: 0,
    msrp: null,
    
    // Dimensions
    width: null,
    depth: null,
    height: null,
    seat_width: null,
    seat_depth: null,
    seat_height: null,
    arm_height: null,
    back_height: null,
    
    // Weight & Volume
    weight: null,
    shipping_weight: null,
    volume: null,
    yardage: null,
    
    // Materials & Construction
    frame_material: '',
    construction_details: '',
    
    // Features
    features: [],
    
    // Options
    available_finishes: [],
    available_upholsteries: [],
    available_colors: [],
    
    // Images
    images: [],
    primary_image_url: '',
    
    // Inventory
    stock_status: 'Unknown',
    lead_time_days: null,
    minimum_order_quantity: 1,
    
    // Certifications
    flame_certifications: [],
    green_certifications: [],
    ada_compliant: false,
    
    // Status
    is_active: true,
    is_featured: false,
    is_new: false,
    is_outdoor_suitable: false,
    
    // SEO
    meta_title: '',
    meta_description: '',
    
    // Tmp-specific
    requires_review: true,
    extraction_confidence: 50,
  });
  const [variations, setVariations] = useState([]);

  // Load product data
  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const data = await virtualCatalogService.getTmpProduct(productId);
      setProduct(data);
      setFormData({
        ...data,
        base_price: data.base_price ? data.base_price / 100 : 0, // Convert cents to dollars for form
        msrp: data.msrp ? data.msrp / 100 : null,
      });
      setVariations(data.variations || []);
    } catch (error) {
      toast.error('Failed to load product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayAdd = (field, newItem) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), newItem]
    }));
  };

  const handleArrayRemove = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Prepare updates (convert prices back to cents)
      const updates = {
        ...formData,
        base_price: Math.round((formData.base_price || 0) * 100),
        msrp: formData.msrp ? Math.round(formData.msrp * 100) : null,
        variations: variations,  // Include variations in the update
      };

      await virtualCatalogService.updateTmpProduct(productId, updates);
      toast.success('Product updated successfully');
      
      if (onSave) {
        onSave();
      }
    } catch (error) {
      toast.error('Failed to save product: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-300">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-300">Product not found</p>
        <Button onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'basic', name: 'Basic Info', icon: FileText },
    { id: 'pricing', name: 'Pricing & Inventory', icon: DollarSign },
    { id: 'dimensions', name: 'Dimensions', icon: Ruler },
    { id: 'images', name: 'Images', icon: ImageIcon },
    { id: 'materials', name: 'Materials & Features', icon: Wrench },
    { id: 'variations', name: 'Variations', icon: Package },
    { id: 'certs', name: 'Certifications & SEO', icon: Award },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-dark-50">Edit Product</h2>
            <p className="text-dark-300 text-sm">
              {product.model_number} - {product.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-accent-500 text-accent-500'
                    : 'border-transparent text-dark-300 hover:text-dark-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-8">
        {activeTab === 'basic' && <BasicInfoTab formData={formData} onChange={handleInputChange} />}
        {activeTab === 'pricing' && <PricingTab formData={formData} onChange={handleInputChange} />}
        {activeTab === 'dimensions' && <DimensionsTab formData={formData} onChange={handleInputChange} />}
        {activeTab === 'images' && <ImagesTab formData={formData} onChange={handleInputChange} />}
        {activeTab === 'materials' && (
          <MaterialsTab 
            formData={formData} 
            onChange={handleInputChange}
            onArrayAdd={handleArrayAdd}
            onArrayRemove={handleArrayRemove}
          />
        )}
        {activeTab === 'variations' && (
          <VariationsTab 
            variations={variations}
            setVariations={setVariations}
          />
        )}
        {activeTab === 'certs' && (
          <CertificationsTab 
            formData={formData} 
            onChange={handleInputChange}
            onArrayAdd={handleArrayAdd}
            onArrayRemove={handleArrayRemove}
          />
        )}
      </div>

      {/* Sticky Save Button */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-dark-800 border-t border-dark-700 p-4 flex justify-end gap-2 z-10">
        <Button
          variant="outline"
          onClick={onBack}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

// Basic Info Tab Component
const BasicInfoTab = ({ formData, onChange }) => (
  <Card className="p-6">
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Model Number *
          </label>
          <input
            type="text"
            value={formData.model_number || ''}
            onChange={(e) => onChange('model_number', e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Model Suffix
          </label>
          <input
            type="text"
            value={formData.model_suffix || ''}
            onChange={(e) => onChange('model_suffix', e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Product Name *
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Slug
        </label>
        <input
          type="text"
          value={formData.slug || ''}
          onChange={(e) => onChange('slug', e.target.value)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Short Description
        </label>
        <textarea
          value={formData.short_description || ''}
          onChange={(e) => onChange('short_description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Full Description
        </label>
        <textarea
          value={formData.full_description || ''}
          onChange={(e) => onChange('full_description', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_active || false}
            onChange={(e) => onChange('is_active', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">Active</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_featured || false}
            onChange={(e) => onChange('is_featured', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">Featured</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_new || false}
            onChange={(e) => onChange('is_new', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">New Product</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.requires_review || false}
            onChange={(e) => onChange('requires_review', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">Requires Review</span>
        </label>
      </div>
    </div>
  </Card>
);

// Pricing Tab Component
const PricingTab = ({ formData, onChange }) => (
  <Card className="p-6">
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Base Price ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.base_price || 0}
            onChange={(e) => onChange('base_price', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            MSRP ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.msrp || ''}
            onChange={(e) => onChange('msrp', parseFloat(e.target.value) || null)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Stock Status
          </label>
          <select
            value={formData.stock_status || 'Unknown'}
            onChange={(e) => onChange('stock_status', e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          >
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
            <option value="Made to Order">Made to Order</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Lead Time (days)
          </label>
          <input
            type="number"
            value={formData.lead_time_days || ''}
            onChange={(e) => onChange('lead_time_days', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Minimum Order Quantity
          </label>
          <input
            type="number"
            value={formData.minimum_order_quantity || 1}
            onChange={(e) => onChange('minimum_order_quantity', parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>
      </div>
    </div>
  </Card>
);

// Dimensions Tab Component
const DimensionsTab = ({ formData, onChange }) => (
  <Card className="p-6">
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Overall Dimensions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Width (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.width || ''}
              onChange={(e) => onChange('width', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Depth (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.depth || ''}
              onChange={(e) => onChange('depth', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Height (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.height || ''}
              onChange={(e) => onChange('height', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Seat Dimensions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Seat Width (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.seat_width || ''}
              onChange={(e) => onChange('seat_width', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Seat Depth (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.seat_depth || ''}
              onChange={(e) => onChange('seat_depth', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Seat Height (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.seat_height || ''}
              onChange={(e) => onChange('seat_height', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Additional Measurements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Arm Height (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.arm_height || ''}
              onChange={(e) => onChange('arm_height', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Back Height (inches)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.back_height || ''}
              onChange={(e) => onChange('back_height', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.weight || ''}
              onChange={(e) => onChange('weight', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Yardage
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.yardage || ''}
              onChange={(e) => onChange('yardage', parseFloat(e.target.value) || null)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
            />
          </div>
        </div>
      </div>
    </div>
  </Card>
);

// Images Tab Component
const ImagesTab = ({ formData, onChange }) => {
  const allImages = [
    ...(formData.images || []),
    formData.primary_image_url,
    formData.hover_image_url,
  ].filter(Boolean);

  const handleSetPrimary = (imageUrl) => {
    onChange('primary_image_url', imageUrl);
  };

  const handleSetHover = (imageUrl) => {
    onChange('hover_image_url', imageUrl);
  };

  const handleAddToGallery = (imageUrl) => {
    const currentImages = formData.images || [];
    if (!currentImages.includes(imageUrl)) {
      onChange('images', [...currentImages, imageUrl]);
    }
  };

  const handleRemoveFromGallery = (imageUrl) => {
    const newImages = (formData.images || []).filter(img => img !== imageUrl);
    onChange('images', newImages);
  };

  const handleRemoveImage = (imageUrl) => {
    // Remove from all locations
    if (formData.primary_image_url === imageUrl) {
      onChange('primary_image_url', '');
    }
    if (formData.hover_image_url === imageUrl) {
      onChange('hover_image_url', '');
    }
    handleRemoveFromGallery(imageUrl);
  };

  const getImageUsage = (imageUrl) => {
    const usage = [];
    if (formData.primary_image_url === imageUrl) usage.push('Primary');
    if (formData.hover_image_url === imageUrl) usage.push('Hover');
    if ((formData.images || []).includes(imageUrl)) usage.push('Gallery');
    return usage;
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-dark-50 mb-4">Product Images</h3>
          {allImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allImages.map((img, index) => {
                const usage = getImageUsage(img);
                return (
                  <div key={index} className="relative group border-2 rounded-lg overflow-hidden"
                       style={{
                         borderColor: usage.includes('Primary') ? '#10b981' : 
                                     usage.includes('Hover') ? '#3b82f6' : 
                                     '#374151'
                       }}>
                    <img
                      src={resolveImageUrl(img)}
                      alt={`Product ${index + 1}`}
                      className="w-full h-48 object-contain bg-white"
                    />
                    
                    {/* Usage badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {usage.map((type) => (
                        <span
                          key={type}
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            type === 'Primary' ? 'bg-green-500 text-white' :
                            type === 'Hover' ? 'bg-blue-500 text-white' :
                            'bg-purple-500 text-white'
                          }`}
                        >
                          {type}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <div className="flex flex-col gap-1 w-full">
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(img)}
                          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                          disabled={formData.primary_image_url === img}
                        >
                          Set Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetHover(img)}
                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                          disabled={formData.hover_image_url === img}
                        >
                          Set Hover
                        </button>
                        {(formData.images || []).includes(img) ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveFromGallery(img)}
                            className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                          >
                            Remove Gallery
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToGallery(img)}
                            className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                          >
                            Add to Gallery
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          Remove All
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-dark-300 text-center py-8">No images available</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dark-600">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Primary Image
            </label>
            {formData.primary_image_url ? (
              <div className="flex items-center gap-2">
                <img
                  src={resolveImageUrl(formData.primary_image_url)}
                  alt="Primary"
                  className="w-16 h-16 object-contain bg-white rounded border-2 border-green-500"
                />
                <span className="text-dark-300 text-sm flex-1 truncate">
                  {formData.primary_image_url.split('/').pop()}
                </span>
              </div>
            ) : (
              <p className="text-dark-400 text-sm">No primary image set</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Hover Image
            </label>
            {formData.hover_image_url ? (
              <div className="flex items-center gap-2">
                <img
                  src={resolveImageUrl(formData.hover_image_url)}
                  alt="Hover"
                  className="w-16 h-16 object-contain bg-white rounded border-2 border-blue-500"
                />
                <span className="text-dark-300 text-sm flex-1 truncate">
                  {formData.hover_image_url.split('/').pop()}
                </span>
              </div>
            ) : (
              <p className="text-dark-400 text-sm">No hover image set</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Gallery Images ({(formData.images || []).length})
          </label>
          {(formData.images || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formData.images.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={resolveImageUrl(img)}
                    alt={`Gallery ${idx + 1}`}
                    className="w-20 h-20 object-contain bg-white rounded border-2 border-purple-500"
                  />
                  <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-400 text-sm">No gallery images</p>
          )}
        </div>
      </div>
    </Card>
  );
};

// Materials Tab Component
const MaterialsTab = ({ formData, onChange, onArrayAdd, onArrayRemove }) => {
  const [newFeature, setNewFeature] = useState('');

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Frame Material
          </label>
          <input
            type="text"
            value={formData.frame_material || ''}
            onChange={(e) => onChange('frame_material', e.target.value)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Construction Details
          </label>
          <textarea
            value={formData.construction_details || ''}
            onChange={(e) => onChange('construction_details', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Features
          </label>
          <div className="space-y-2">
            {formData.features && formData.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => {
                    const newFeatures = [...formData.features];
                    newFeatures[index] = e.target.value;
                    onChange('features', newFeatures);
                  }}
                  className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                />
                <button
                  type="button"
                  onClick={() => onArrayRemove('features', index)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newFeature.trim()) {
                    onArrayAdd('features', newFeature.trim());
                    setNewFeature('');
                  }
                }}
                placeholder="Add new feature..."
                className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
              />
              <button
                type="button"
                onClick={() => {
                  if (newFeature.trim()) {
                    onArrayAdd('features', newFeature.trim());
                    setNewFeature('');
                  }
                }}
                className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Variations Tab Component
const VariationsTab = ({ variations, setVariations }) => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEdit = (variation) => {
    setEditingId(variation.id);
    setEditForm({ ...variation });
  };

  const handleSaveEdit = () => {
    setVariations(variations.map(v => 
      v.id === editingId ? editForm : v
    ));
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (variationId) => {
    if (window.confirm('Delete this variation?')) {
      setVariations(variations.filter(v => v.id !== variationId));
    }
  };

  const handleAdd = () => {
    const newVariation = {
      id: Date.now(), // Temporary ID for new variations
      sku: '',
      suffix: '',
      suffix_description: '',
      stock_status: 'Unknown',
      lead_time_days: null,
      price_adjustment: 0,
      is_available: true,
    };
    setVariations([...variations, newVariation]);
    setEditingId(newVariation.id);
    setEditForm(newVariation);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark-50">Product Variations</h3>
          <Button
            onClick={handleAdd}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Variation
          </Button>
        </div>

        {variations && variations.length > 0 ? (
          <div className="space-y-3">
            {variations.map((variation) => (
              <div key={variation.id} className="p-4 bg-dark-700 rounded-lg">
                {editingId === variation.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-dark-300 mb-1">SKU *</label>
                        <input
                          type="text"
                          value={editForm.sku || ''}
                          onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-300 mb-1">Suffix</label>
                        <input
                          type="text"
                          value={editForm.suffix || ''}
                          onChange={(e) => setEditForm({ ...editForm, suffix: e.target.value })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-dark-300 mb-1">Suffix Description</label>
                      <input
                        type="text"
                        value={editForm.suffix_description || ''}
                        onChange={(e) => setEditForm({ ...editForm, suffix_description: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-dark-300 mb-1">Stock Status</label>
                        <select
                          value={editForm.stock_status || 'Unknown'}
                          onChange={(e) => setEditForm({ ...editForm, stock_status: e.target.value })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                        >
                          <option value="In Stock">In Stock</option>
                          <option value="Low Stock">Low Stock</option>
                          <option value="Out of Stock">Out of Stock</option>
                          <option value="Made to Order">Made to Order</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-dark-300 mb-1">Lead Time (days)</label>
                        <input
                          type="number"
                          value={editForm.lead_time_days || ''}
                          onChange={(e) => setEditForm({ ...editForm, lead_time_days: parseInt(e.target.value) || null })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-dark-300 mb-1">Price Adjustment ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.price_adjustment ? editForm.price_adjustment / 100 : 0}
                          onChange={(e) => setEditForm({ ...editForm, price_adjustment: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-50 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.is_available || false}
                          onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-700"
                        />
                        <span className="text-dark-200 text-sm">Available</span>
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-dark-600">
                      <Button
                        onClick={handleSaveEdit}
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-dark-50">{variation.sku}</span>
                          {variation.suffix && (
                            <span className="px-2 py-0.5 bg-dark-600 text-dark-200 text-xs rounded">
                              {variation.suffix}
                            </span>
                          )}
                          {!variation.is_available && (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-xs rounded">
                              Unavailable
                            </span>
                          )}
                        </div>
                        {variation.suffix_description && (
                          <p className="text-dark-300 text-sm">{variation.suffix_description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                          <div>
                            <span className="text-dark-400">Status:</span>{' '}
                            <span className="text-dark-200">{variation.stock_status}</span>
                          </div>
                          {variation.lead_time_days && (
                            <div>
                              <span className="text-dark-400">Lead Time:</span>{' '}
                              <span className="text-dark-200">{variation.lead_time_days} days</span>
                            </div>
                          )}
                          {variation.price_adjustment !== 0 && (
                            <div>
                              <span className="text-dark-400">Price Adj:</span>{' '}
                              <span className={variation.price_adjustment > 0 ? 'text-green-500' : 'text-red-500'}>
                                {variation.price_adjustment > 0 ? '+' : ''}${(variation.price_adjustment / 100).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => handleEdit(variation)}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(variation.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-300 text-center py-8">
            No variations found. Click "Add Variation" to create one.
          </p>
        )}
      </div>
    </Card>
  );
};

// Certifications Tab Component
const CertificationsTab = ({ formData, onChange }) => (
  <Card className="p-6">
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.ada_compliant || false}
            onChange={(e) => onChange('ada_compliant', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">ADA Compliant</span>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_outdoor_suitable || false}
            onChange={(e) => onChange('is_outdoor_suitable', e.target.checked)}
            className="w-4 h-4 rounded border-dark-600 bg-dark-700"
          />
          <span className="text-dark-200">Outdoor Suitable</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Meta Title
        </label>
        <input
          type="text"
          value={formData.meta_title || ''}
          onChange={(e) => onChange('meta_title', e.target.value)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Meta Description
        </label>
        <textarea
          value={formData.meta_description || ''}
          onChange={(e) => onChange('meta_description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Extraction Confidence (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.extraction_confidence || 50}
          onChange={(e) => onChange('extraction_confidence', parseInt(e.target.value) || 50)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
        />
      </div>
    </div>
  </Card>
);

export default VirtualCatalogProductEditor;
