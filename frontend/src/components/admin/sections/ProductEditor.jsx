import { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import axios from 'axios';
import { 
  FileText, 
  DollarSign, 
  Ruler, 
  Image as ImageIcon, 
  RefreshCw, 
  Settings, 
  Search,
  Upload,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  Wrench,
  Award,
  TrendingUp,
  Package
} from 'lucide-react';

/**
 * Comprehensive Product Editor
 * 
 * Full product editing with tabs for:
 * - Basic Info
 * - Pricing
 * - Dimensions
 * - Images
 * - Materials & Construction
 * - Features & Inventory
 * - Variations
 * - Certifications & Usage
 * - SEO & Analytics
 */
const ProductEditor = ({ product, onBack }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    model_number: '',
    model_suffix: '',
    slug: '',
    category_id: null,
    subcategory_id: null,
    family_id: null,
    short_description: '',
    full_description: '',
    base_price: 0,
    msrp: null,
    width: null,
    depth: null,
    height: null,
    seat_width: null,
    seat_depth: null,
    seat_height: null,
    arm_height: null,
    back_height: null,
    weight: null,
    shipping_weight: null,
    frame_material: '',
    construction_details: '',
    features: [],
    stock_status: 'In Stock',
    lead_time_days: null,
    minimum_order_quantity: 1,
    is_featured: false,
    is_new: false,
    is_active: true,
    is_custom_only: false,
    is_outdoor_suitable: false,
    ada_compliant: false,
    meta_title: '',
    meta_description: '',
    ...product
  });
  const [saving, setSaving] = useState(false);
  
  // Dropdowns data
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [finishes, setFinishes] = useState([]);
  const [upholsteries, setUpholsteries] = useState([]);
  const [colors, setColors] = useState([]);
  
  // Multi-value fields
  const [images, setImages] = useState(product?.images || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [variations, setVariations] = useState(product?.variations || []);
  const [selectedFinishes, setSelectedFinishes] = useState(product?.available_finishes || []);
  const [selectedUpholsteries, setSelectedUpholsteries] = useState(product?.available_upholsteries || []);
  const [selectedColors, setSelectedColors] = useState(product?.available_colors || []);
  const [flameCerts, setFlameCerts] = useState(product?.flame_certifications || []);
  const [greenCerts, setGreenCerts] = useState(product?.green_certifications || []);

  // Image upload helper function
  const uploadImage = async (file, subfolder = 'products') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subfolder', subfolder);
    
    const response = await axios.post('/api/v1/admin/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.url;
  };

  // Image delete helper function
  const deleteImage = async (url) => {
    if (!url) return;
    
    try {
      await axios.delete('/api/v1/admin/upload/image', {
        data: { url }
      });
    } catch (error) {
      console.error('Failed to delete image:', error);
      // Don't throw - we still want to remove from UI even if server delete fails
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchFamilies();
    fetchFinishes();
    fetchUpholsteries();
    fetchColors();
  }, []);
  
  // Fetch subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/v1/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };
  
  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await axios.get(`/api/v1/admin/subcategories?category_id=${categoryId}`);
      setSubcategories(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch subcategories:', error);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await axios.get('/api/v1/admin/families');
      setFamilies(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch families:', error);
    }
  };
  
  const fetchFinishes = async () => {
    try {
      const response = await axios.get('/api/v1/admin/finishes');
      setFinishes(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch finishes:', error);
      setFinishes([]);
    }
  };
  
  const fetchUpholsteries = async () => {
    try {
      const response = await axios.get('/api/v1/admin/upholsteries');
      setUpholsteries(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch upholsteries:', error);
      setUpholsteries([]);
    }
  };
  
  const fetchColors = async () => {
    try {
      const response = await axios.get('/api/v1/admin/colors');
      setColors(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
      setColors([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveData = {
        ...formData,
        images,
        variations,
        available_finishes: selectedFinishes,
        available_upholsteries: selectedUpholsteries,
        available_colors: selectedColors,
        flame_certifications: flameCerts,
        green_certifications: greenCerts,
      };
      
      if (product?._isNew) {
        await axios.post('/api/v1/admin/products', saveData);
      } else {
        await axios.patch(`/api/v1/admin/products/${product.id}`, saveData);
      }
      toast.success('Product saved successfully!');
      onBack();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleArrayChange = (field, value) => {
    const arr = value.split(',').map(v => v.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, [field]: arr }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: FileText },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'dimensions', label: 'Dimensions', icon: Ruler },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'materials', label: 'Materials', icon: Wrench },
    { id: 'features', label: 'Features', icon: Package },
    { id: 'variations', label: 'Variations', icon: RefreshCw },
    { id: 'certifications', label: 'Certifications', icon: Award },
    { id: 'seo', label: 'SEO & Analytics', icon: TrendingUp },
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
                  Model Suffix
                </label>
                <input
                  type="text"
                  value={formData.model_suffix || ''}
                  onChange={(e) => handleChange('model_suffix', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., WB.P, P, W"
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
                  onChange={(e) => {
                    const categoryId = parseInt(e.target.value) || null;
                    handleChange('category_id', categoryId);
                    handleChange('subcategory_id', null);
                  }}
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
                  Subcategory
                </label>
                <select
                  value={formData.subcategory_id || ''}
                  onChange={(e) => handleChange('subcategory_id', parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  disabled={!formData.category_id}
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
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
            
            <h3 className="text-lg font-bold text-dark-50 pt-4">Additional Dimensions (inches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Arm Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.arm_height || ''}
                  onChange={(e) => handleChange('arm_height', parseFloat(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Back Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.back_height || ''}
                  onChange={(e) => handleChange('back_height', parseFloat(e.target.value) || null)}
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
            {/* Main Product Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Key Product Images</h3>
              <p className="text-sm text-dark-400 mb-4">These images are used in product catalog views and cards</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Primary Image */}
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Primary Image *
                    <span className="block text-xs text-dark-400 font-normal">Main catalog image</span>
                  </label>
                  <div className="relative">
                    {formData.primary_image_url ? (
                      <div className="relative group">
                        <img
                          src={formData.primary_image_url}
                          alt="Primary"
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-primary-500"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteImage(formData.primary_image_url);
                            handleChange('primary_image_url', null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400 mb-2">Click to upload</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const url = await uploadImage(file);
                                handleChange('primary_image_url', url);
                              } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to upload image');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover Image */}
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Hover Image
                    <span className="block text-xs text-dark-400 font-normal">Shown on card hover</span>
                  </label>
                  <div className="relative">
                    {formData.hover_image_url ? (
                      <div className="relative group">
                        <img
                          src={formData.hover_image_url}
                          alt="Hover"
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteImage(formData.hover_image_url);
                            handleChange('hover_image_url', null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400 mb-2">Click to upload</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const url = await uploadImage(file);
                                handleChange('hover_image_url', url);
                              } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to upload image');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnail */}
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Thumbnail
                    <span className="block text-xs text-dark-400 font-normal">Small preview image</span>
                  </label>
                  <div className="relative">
                    {formData.thumbnail ? (
                      <div className="relative group">
                        <img
                          src={formData.thumbnail}
                          alt="Thumbnail"
                          className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteImage(formData.thumbnail);
                            handleChange('thumbnail', null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                        <Upload className="w-8 h-8 text-dark-400 mx-auto mb-2" />
                        <p className="text-sm text-dark-400 mb-2">Click to upload</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const url = await uploadImage(file);
                                handleChange('thumbnail', url);
                              } catch (error) {
                                console.error('Upload failed:', error);
                                alert('Failed to upload image');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Images */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Gallery Images</h3>
              <p className="text-sm text-dark-400 mb-4">Additional product photos for detail views</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={typeof img === 'string' ? img : img.url}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-48 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const imgUrl = typeof img === 'string' ? img : img.url;
                        await deleteImage(imgUrl);
                        setImages(images.filter((_, i) => i !== index));
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-dark-900/80 text-dark-200 text-xs rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                <Upload className="w-10 h-10 text-dark-400 mx-auto mb-3" />
                <p className="text-dark-200 mb-2">Add Gallery Images</p>
                <p className="text-sm text-dark-400 mb-4">
                  {uploadingImage ? 'Uploading...' : 'Click or drag & drop images'}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    
                    setUploadingImage(true);
                    try {
                      const uploadPromises = files.map(file => uploadImage(file));
                      const urls = await Promise.all(uploadPromises);
                      setImages([...images, ...urls]);
                    } catch (error) {
                      console.error('Upload failed:', error);
                      alert('Failed to upload one or more images');
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingImage}
                />
              </div>
            </div>

            {/* Variation Images */}
            {variations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-dark-50 mb-4">Variation Images</h3>
                <p className="text-sm text-dark-400 mb-4">Specific images for each product variation</p>
                
                {variations.map((variation, index) => (
                  <div key={index} className="bg-dark-800 rounded-lg p-4 mb-4">
                    <h4 className="text-md font-medium text-dark-100 mb-3">
                      Variation: {variation.sku || `Variation ${index + 1}`}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Variation Primary Image */}
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Primary Image
                        </label>
                        <div className="relative">
                          {variation.primary_image_url ? (
                            <div className="relative group">
                              <img
                                src={variation.primary_image_url}
                                alt={`Variation ${index + 1} Primary`}
                                className="w-full h-40 object-contain bg-dark-700 rounded-lg border-2 border-dark-600"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteImage(variation.primary_image_url);
                                  const newVariations = [...variations];
                                  newVariations[index].primary_image_url = null;
                                  setVariations(newVariations);
                                }}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-dark-600 rounded-lg p-3 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                              <Upload className="w-6 h-6 text-dark-400 mx-auto mb-2" />
                              <p className="text-xs text-dark-400">Click to upload</p>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await uploadImage(file);
                                      const newVariations = [...variations];
                                      newVariations[index].primary_image_url = url;
                                      setVariations(newVariations);
                                    } catch (error) {
                                      console.error('Upload failed:', error);
                                      alert('Failed to upload image');
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Variation Gallery Images */}
                      <div>
                        <label className="block text-sm font-medium text-dark-200 mb-2">
                          Gallery Images ({(variation.images || []).length})
                        </label>
                        <div className="space-y-2">
                          {(variation.images || []).length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {variation.images.map((img, imgIndex) => (
                                <div key={imgIndex} className="relative group">
                                  <img
                                    src={typeof img === 'string' ? img : img.url}
                                    alt={`Variation ${index + 1} Image ${imgIndex + 1}`}
                                    className="w-full h-20 object-contain bg-dark-700 rounded border border-dark-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const imgUrl = typeof img === 'string' ? img : img.url;
                                      await deleteImage(imgUrl);
                                      const newVariations = [...variations];
                                      newVariations[index].images = newVariations[index].images.filter((_, i) => i !== imgIndex);
                                      setVariations(newVariations);
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="border-2 border-dashed border-dark-600 rounded-lg p-2 text-center hover:border-primary-500 transition-colors cursor-pointer relative">
                            <Upload className="w-5 h-5 text-dark-400 mx-auto mb-1" />
                            <p className="text-xs text-dark-400 mb-1">Upload images</p>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;
                                
                                try {
                                  const uploadPromises = files.map(file => uploadImage(file));
                                  const urls = await Promise.all(uploadPromises);
                                  const newVariations = [...variations];
                                  newVariations[index].images = [...(newVariations[index].images || []), ...urls];
                                  setVariations(newVariations);
                                } catch (error) {
                                  console.error('Upload failed:', error);
                                  alert('Failed to upload images');
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'variations':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-50">Product Variations</h3>
              <Button
                onClick={() => setVariations([...variations, { 
                  sku: '', 
                  finish_id: null,
                  upholstery_id: null,
                  color_id: null,
                  price_adjustment: 0, 
                  stock_status: 'Available',
                  is_available: true
                }])}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Variation
              </Button>
            </div>
            
            <p className="text-sm text-dark-300">
              Variations represent specific combinations of finish, upholstery, and color options for this product.
            </p>
            
            {variations.length === 0 ? (
              <div className="text-center py-12 bg-dark-700 rounded-lg border-2 border-dashed border-dark-600">
                <RefreshCw className="w-12 h-12 text-dark-400 mx-auto mb-4" />
                <p className="text-dark-300">No variations added</p>
                <p className="text-sm text-dark-400 mt-2">
                  Add variations for different finish, upholstery, or color combinations
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {variations.map((variation, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              SKU *
                            </label>
                            <input
                              type="text"
                              value={variation.sku || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].sku = e.target.value;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                              placeholder="6246-WB-BLK"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Stock Status
                            </label>
                            <select
                              value={variation.stock_status || 'Available'}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].stock_status = e.target.value;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="Available">Available</option>
                              <option value="Low Stock">Low Stock</option>
                              <option value="Out of Stock">Out of Stock</option>
                              <option value="Discontinued">Discontinued</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Finish
                            </label>
                            <select
                              value={variation.finish_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].finish_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Finish</option>
                              {finishes.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Upholstery
                            </label>
                            <select
                              value={variation.upholstery_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].upholstery_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Upholstery</option>
                              {upholsteries.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Color
                            </label>
                            <select
                              value={variation.color_id || ''}
                              onChange={(e) => {
                                const newVariations = [...variations];
                                newVariations[index].color_id = parseInt(e.target.value) || null;
                                setVariations(newVariations);
                              }}
                              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                            >
                              <option value="">No Color</option>
                              {colors.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                              Price Adjustment (USD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={(variation.price_adjustment || 0) / 100}
                                onChange={(e) => {
                                  const newVariations = [...variations];
                                  newVariations[index].price_adjustment = Math.round(parseFloat(e.target.value) * 100) || 0;
                                  setVariations(newVariations);
                                }}
                                className="w-full pl-8 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer pb-2">
                              <input
                                type="checkbox"
                                checked={variation.is_available !== false}
                                onChange={(e) => {
                                  const newVariations = [...variations];
                                  newVariations[index].is_available = e.target.checked;
                                  setVariations(newVariations);
                                }}
                                className="rounded border-dark-500"
                              />
                              <span className="text-dark-200">Available for Sale</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setVariations(variations.filter((_, i) => i !== index))}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors mt-6"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 'materials':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Materials & Construction</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Frame Material
                </label>
                <input
                  type="text"
                  value={formData.frame_material || ''}
                  onChange={(e) => handleChange('frame_material', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Solid Wood, Metal, Aluminum"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Construction Details
              </label>
              <textarea
                value={formData.construction_details || ''}
                onChange={(e) => handleChange('construction_details', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Describe construction methods, joinery, reinforcements, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Available Finishes
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {finishes.map(finish => (
                  <label key={finish.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedFinishes.includes(finish.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFinishes([...selectedFinishes, finish.id]);
                        } else {
                          setSelectedFinishes(selectedFinishes.filter(id => id !== finish.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <span className="text-sm text-dark-200">{finish.name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Available Upholsteries
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {upholsteries.map(upholstery => (
                  <label key={upholstery.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedUpholsteries.includes(upholstery.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUpholsteries([...selectedUpholsteries, upholstery.id]);
                        } else {
                          setSelectedUpholsteries(selectedUpholsteries.filter(id => id !== upholstery.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <span className="text-sm text-dark-200">{upholstery.name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Available Colors
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-dark-700 rounded-lg max-h-64 overflow-y-auto">
                {colors.map(color => (
                  <label key={color.id} className="flex items-center gap-2 cursor-pointer hover:bg-dark-600 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedColors.includes(color.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColors([...selectedColors, color.id]);
                        } else {
                          setSelectedColors(selectedColors.filter(id => id !== color.id));
                        }
                      }}
                      className="rounded border-dark-500"
                    />
                    <div className="flex items-center gap-2">
                      {color.hex_value && (
                        <div 
                          className="w-4 h-4 rounded border border-dark-500" 
                          style={{ backgroundColor: color.hex_value }}
                        />
                      )}
                      <span className="text-sm text-dark-200">{color.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Features & Inventory</h3>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Features (comma-separated)
              </label>
              <input
                type="text"
                value={formData.features?.join(', ') || ''}
                onChange={(e) => handleArrayChange('features', e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="e.g., Stackable, Ganging, Swivel, Arms"
              />
              <p className="text-xs text-dark-400 mt-1">Separate multiple features with commas</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Stock Status
                </label>
                <select
                  value={formData.stock_status}
                  onChange={(e) => handleChange('stock_status', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Pre-Order">Pre-Order</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  value={formData.lead_time_days || ''}
                  onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value) || null)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Minimum Order Quantity
                </label>
                <input
                  type="number"
                  value={formData.minimum_order_quantity}
                  onChange={(e) => handleChange('minimum_order_quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        );

      case 'certifications':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">Certifications & Usage</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Flame Certifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={flameCerts.join(', ')}
                  onChange={(e) => {
                    const certs = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                    setFlameCerts(certs);
                  }}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., CAL 117, UFAC Class 1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Green Certifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={greenCerts.join(', ')}
                  onChange={(e) => {
                    const certs = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                    setGreenCerts(certs);
                  }}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., FSC, GREENGUARD"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Recommended Use
                </label>
                <input
                  type="text"
                  value={formData.recommended_use || ''}
                  onChange={(e) => handleChange('recommended_use', e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Restaurant, Healthcare, Office"
                />
              </div>
              
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ada_compliant}
                    onChange={(e) => handleChange('ada_compliant', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">ADA Compliant</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_outdoor_suitable}
                    onChange={(e) => handleChange('is_outdoor_suitable', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Outdoor Suitable</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Warranty Information
              </label>
              <textarea
                value={formData.warranty_info || ''}
                onChange={(e) => handleChange('warranty_info', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Warranty details..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Care Instructions
              </label>
              <textarea
                value={formData.care_instructions || ''}
                onChange={(e) => handleChange('care_instructions', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Care and maintenance instructions..."
              />
            </div>
          </div>
        );

      case 'seo':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-dark-50">SEO & Analytics</h3>
            
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
            
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={formData.keywords?.join(', ') || ''}
                onChange={(e) => handleArrayChange('keywords', e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="chair, dining, restaurant, commercial"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-md font-medium text-dark-100">Product Flags</h4>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Active (visible on site)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => handleChange('is_featured', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Featured Product</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_new}
                    onChange={(e) => handleChange('is_new', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">New Product</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_custom_only}
                    onChange={(e) => handleChange('is_custom_only', e.target.checked)}
                    className="rounded border-dark-500"
                  />
                  <span className="text-dark-200">Custom Only (requires quote)</span>
                </label>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-md font-medium text-dark-100">Analytics</h4>
                
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    View Count
                  </label>
                  <input
                    type="number"
                    value={formData.view_count || 0}
                    disabled
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-400 outline-none cursor-not-allowed"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quote Count
                  </label>
                  <input
                    type="number"
                    value={formData.quote_count || 0}
                    disabled
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-400 outline-none cursor-not-allowed"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order || 0}
                    onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
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
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
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
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
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
