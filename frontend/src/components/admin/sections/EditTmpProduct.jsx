import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Package, Image as ImageIcon } from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { resolveImageUrl } from '../../../utils/apiHelpers';
import virtualCatalogService from '../../../services/virtualCatalogService';

/**
 * Edit Temporary Product
 * 
 * Full-page editor for reviewing and editing temporary product data
 * before importing to production catalog
 */
const EditTmpProduct = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract numeric ID from URL path like /admin/catalog/virtual-upload/edit/123
  const pathParts = location.pathname.split('/');
  const productId = pathParts[pathParts.length - 1];
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    model_number: '',
    short_description: '',
    full_description: '',
    family_id: null,
    category_id: null,
    subcategory_id: null,
    base_price: 0,
    msrp: 0,
    width: null,
    depth: null,
    height: null,
    seat_width: null,
    seat_depth: null,
    seat_height: null,
    weight: null,
    frame_material: '',
    stock_status: 'Unknown',
    requires_review: true,
  });

  // Load product data
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const data = await virtualCatalogService.getTmpProduct(productId);
        setProduct(data);
        
        // Populate form
        setFormData({
          name: data.name || '',
          model_number: data.model_number || '',
          short_description: data.short_description || '',
          full_description: data.full_description || '',
          family_id: data.family?.id || null,
          category_id: data.category_id || null,
          subcategory_id: data.subcategory_id || null,
          base_price: data.base_price || 0,
          msrp: data.msrp || 0,
          width: data.dimensions?.width || null,
          depth: data.dimensions?.depth || null,
          height: data.dimensions?.height || null,
          seat_width: data.dimensions?.seat_width || null,
          seat_depth: data.dimensions?.seat_depth || null,
          seat_height: data.dimensions?.seat_height || null,
          weight: data.dimensions?.weight || null,
          frame_material: data.frame_material || '',
          stock_status: data.stock_status || 'Unknown',
          requires_review: data.requires_review ?? true,
        });
      } catch (err) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await virtualCatalogService.updateTmpProduct(productId, formData);
      navigate('/admin/catalog/virtual-upload');
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await virtualCatalogService.deleteTmpProduct(productId);
      navigate('/admin/catalog/virtual-upload');
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dark-300">Loading product...</div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/admin/catalog/virtual-upload')}
            variant="secondary"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Catalog Upload
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-dark-50">Edit Temporary Product</h1>
            <p className="text-dark-300 text-sm mt-1">
              Review and edit extracted product data before import
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            variant="secondary"
            className="text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Model Number *
                  </label>
                  <input
                    type="text"
                    name="model_number"
                    value={formData.model_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Short Description
                </label>
                <textarea
                  name="short_description"
                  value={formData.short_description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Full Description
                </label>
                <textarea
                  name="full_description"
                  value={formData.full_description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Frame Material
                  </label>
                  <input
                    type="text"
                    name="frame_material"
                    value={formData.frame_material}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Stock Status
                  </label>
                  <select
                    name="stock_status"
                    value={formData.stock_status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                  >
                    <option value="Unknown">Unknown</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Made to Order">Made to Order</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requires_review"
                  checked={formData.requires_review}
                  onChange={handleInputChange}
                  className="w-4 h-4"
                />
                <label className="text-sm text-dark-300">
                  Requires review before import
                </label>
              </div>
            </div>
          </Card>

          {/* Dimensions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4">Dimensions</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Width (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="width"
                  value={formData.width || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Depth (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="depth"
                  value={formData.depth || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Height (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="height"
                  value={formData.height || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Seat Width (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="seat_width"
                  value={formData.seat_width || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Seat Depth (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="seat_depth"
                  value={formData.seat_depth || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Seat Height (inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="seat_height"
                  value={formData.seat_height || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  value={formData.weight || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4">Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Base Price (cents)
                </label>
                <input
                  type="number"
                  name="base_price"
                  value={formData.base_price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
                <p className="text-xs text-dark-400 mt-1">
                  ${(formData.base_price / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  MSRP (cents)
                </label>
                <input
                  type="number"
                  name="msrp"
                  value={formData.msrp}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-dark-50 focus:border-primary-500 focus:outline-none"
                />
                <p className="text-xs text-dark-400 mt-1">
                  ${(formData.msrp / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Images */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Images ({product?.images?.length || 0})
            </h2>
            <div className="space-y-3">
              {product?.images && product.images.length > 0 ? (
                product.images.map((img, index) => (
                  <div key={index} className="rounded-lg bg-dark-800 overflow-hidden">
                    <img
                      src={resolveImageUrl(img)}
                      alt={`${product.name} - ${index + 1}`}
                      className="w-full h-48 object-contain"
                      style={{ mixBlendMode: 'multiply' }}
                      onError={(e) => {
                        e.target.src = '/placeholder.png';
                      }}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center text-dark-400 py-8">
                  No images available
                </div>
              )}
            </div>
          </Card>

          {/* Metadata */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4">Metadata</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-dark-400">Source Page:</span>
                <span className="ml-2 text-dark-50">{product?.source_page}</span>
              </div>
              <div>
                <span className="text-dark-400">Upload ID:</span>
                <span className="ml-2 text-dark-50 font-mono text-xs">{product?.upload_id}</span>
              </div>
              <div>
                <span className="text-dark-400">Extraction Confidence:</span>
                <span className={`ml-2 font-semibold ${
                  product?.extraction_confidence >= 80
                    ? 'text-green-500'
                    : product?.extraction_confidence >= 50
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}>
                  {product?.extraction_confidence}%
                </span>
              </div>
              <div>
                <span className="text-dark-400">Variations:</span>
                <span className="ml-2 text-dark-50">{product?.variations?.length || 0}</span>
              </div>
            </div>
          </Card>

          {/* Variations */}
          {product?.variations && product.variations.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-dark-50 mb-4">Variations</h2>
              <div className="space-y-2">
                {product.variations.map((variation) => (
                  <div
                    key={variation.id}
                    className="p-3 bg-dark-700 rounded-lg text-sm"
                  >
                    <div className="font-medium text-dark-50">{variation.suffix}</div>
                    {variation.suffix_description && (
                      <div className="text-dark-300 text-xs mt-1">
                        {variation.suffix_description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditTmpProduct;
