import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Grid3x3, List } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import QuickViewModal from '../components/ui/QuickViewModal';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import productService from '../services/productService';
import logger from '../utils/logger';

const CONTEXT = 'ProductFamilyDetailPage';

/**
 * Product Family Detail Page
 * 
 * Displays comprehensive details about a product family including:
 * - Family banner and description
 * - All products in the family
 * - Grid or list view toggle
 * - Category information
 */
const ProductFamilyDetailPage = () => {
  const { familySlug } = useParams();
  const navigate = useNavigate();
  
  const [family, setFamily] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    if (familySlug) {
      loadFamily();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familySlug]);

  const loadFamily = async () => {
    setLoading(true);
    try {
      // Fetch family details using slug
      const familyResponse = await productService.getFamilyById(familySlug);
      setFamily(familyResponse);
      
      // Fetch products in this family
      const productsResponse = await productService.getProducts({
        family_id: familyResponse.id,
        per_page: 100, // Get all products in family
        exclude_variations: true,
      });
      
      setProducts(productsResponse.data || []);
      
      logger.info(CONTEXT, `Loaded family ${familyResponse.name} with ${productsResponse.data?.length || 0} products`);
    } catch (error) {
      logger.error(CONTEXT, 'Error loading family details', error);
      // Family not found, redirect to catalog
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!family) {
    return null; // Will redirect
  }

  const productCount = products.length;

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Back Button */}
        <button
          onClick={() => navigate('/products')}
          className="mb-6 flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Catalog
        </button>

        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-slate-600">
          <Link to="/" className="hover:text-primary-500">Home</Link>
          {' '}/{' '}
          <Link to="/products" className="hover:text-primary-500">Products</Link>
          {family.category_name && (
            <>
              {' '}/{' '}
              <span className="hover:text-primary-500">{family.category_name}</span>
            </>
          )}
          {' '}/{' '}
          <span className="text-slate-800 font-medium">{family.name}</span>
        </div>

        {/* Family Header */}
        <div className="mb-8">
          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-[400px_1fr] gap-8 mb-8">
            {/* Left Column - Family Image and Info */}
            <div className="space-y-6">
              {/* Banner Image - Portrait aspect */}
              {(family.banner_image_url || family.family_image) && (
                <div className="relative w-full aspect-[3/4] overflow-hidden bg-cream-100 rounded-2xl shadow-xl">
                  <img
                    src={family.banner_image_url || family.family_image}
                    alt={family.name}
                    className="w-full h-full object-contain"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
              )}

              {/* Family Info */}
              <div>
                <h1 className="text-4xl font-bold mb-3 text-slate-800">
                  {family.name}
                </h1>
                {family.category_name && (
                  <p className="text-lg text-slate-600 mb-4">
                    Category: <span className="font-medium">{family.category_name}</span>
                  </p>
                )}
                <div className="bg-cream-100 px-4 py-2 rounded-lg inline-block">
                  <span className="text-sm font-semibold text-slate-800">
                    {productCount} {productCount === 1 ? 'Product' : 'Products'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {(family.overview_text || family.description) && (
                <div className="bg-white rounded-xl shadow-md border border-cream-200 p-6">
                  <h2 className="text-xl font-semibold mb-3 text-slate-800">
                    About This Family
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    {family.overview_text || family.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Products */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">
                  Products in {family.name}
                </h2>
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-600 hover:bg-cream-100'
                    }`}
                    title="Grid View"
                  >
                    <Grid3x3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-600 hover:bg-cream-100'
                    }`}
                    title="List View"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Products Grid or List */}
              {products.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md border border-cream-200 p-12 text-center">
                  <svg className="mx-auto h-24 w-24 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-xl font-semibold mb-2 text-slate-800">
                    No products in this family yet
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Products will be added soon
                  </p>
                  <Button onClick={() => navigate('/products')} variant="primary">
                    Browse All Products
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={handleQuickView}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-md border border-cream-200 p-6 flex flex-col md:flex-row gap-6 hover:shadow-lg transition-shadow"
                >
                  {/* Product Image */}
                  <div className="md:w-48 h-48 flex-shrink-0">
                    <Link to={`/products/${product.slug || product.id}`}>
                      <img
                        src={product.primary_image_url || product.images?.[0]?.url || '/placeholder-product.jpg'}
                        alt={product.name}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </Link>
                  </div>

                  {/* Product Info */}
                  <div className="flex-1">
                    <Link to={`/products/${product.slug || product.id}`}>
                      <h3 className="text-xl font-semibold text-slate-800 mb-2 hover:text-primary-600 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    
                    {product.model_number && (
                      <p className="text-sm text-slate-500 mb-2">
                        Model: {product.model_number}
                      </p>
                    )}

                    {(product.short_description || product.description) && (
                      <p className="text-slate-600 mb-4 line-clamp-2">
                        {product.short_description || product.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      {product.base_price && (
                        <span className="text-2xl font-bold text-slate-900">
                          ${(product.base_price / 100).toFixed(2)}
                        </span>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickView(product)}
                        >
                          Quick View
                        </Button>
                        <Link to={`/products/${product.slug || product.id}`}>
                          <Button variant="primary" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default ProductFamilyDetailPage;
