import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Grid3x3, List } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import QuickViewModal from '../components/ui/QuickViewModal';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SEOHead from '../components/SEOHead';
import productService from '../services/productService';
import { resolveFileUrl, resolveImageUrl } from '../utils/apiHelpers';
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

  const productCount = products.length;
  const seoTitle = family ? (family.meta_title || `${family.name} Product Family | Eagle Chair`) : '';
  const seoDescription = family ? (family.meta_description || (family.description ? family.description.substring(0, 160) : `Explore the ${family.name} product family from Eagle Chair. Premium commercial seating solutions.`)) : '';
  const familyUrl = family ? `/families/${familySlug}` : '';
  const familyImage = family ? resolveImageUrl(family.banner_image_url || family.family_image || '/og-image.jpg') : '/og-image.jpg';

  const familySchema = useMemo(() => {
    if (!family) return null;
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": family.name,
      "description": family.description || seoDescription,
      "image": `https://www.eaglechair.com${familyImage}`,
      "url": `https://www.eaglechair.com${familyUrl}`,
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.eaglechair.com/" },
          { "@type": "ListItem", "position": 2, "name": "Products", "item": "https://www.eaglechair.com/products" },
          { "@type": "ListItem", "position": 3, "name": family.name, "item": `https://www.eaglechair.com${familyUrl}` }
        ]
      }
    };
  }, [family, familySlug, familyUrl, familyImage, seoDescription]);

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
    return null;
  }

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-cream-50 to-cream-100">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image={familyImage}
        url={familyUrl}
        type="website"
        keywords={`${family.name}, product family, commercial seating, Eagle Chair`}
        canonical={familyUrl}
        structuredData={familySchema}
      />
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
        <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600 overflow-x-auto pb-2">
          <div className="flex items-center whitespace-nowrap min-w-fit">
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
        </div>

        {/* Family Header */}
        <div className="mb-8">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[min(320px,28vw)_1fr] gap-6 sm:gap-8 mb-6 sm:mb-8">
            {/* Left Column - Family Image and Info */}
            <div className="space-y-6">
              <div className="relative w-full max-h-[min(42vh,340px)] aspect-[3/4] overflow-hidden bg-cream-100 rounded-2xl shadow-xl">
                <img
                  src={familyImage}
                  alt={family.name}
                  className="w-full h-full object-contain"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </div>

              {/* Family Info */}
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-slate-800">
                  {family.name}
                </h1>
                {family.category_name && (
                  <p className="text-lg text-slate-600 mb-4">
                    Category: <span className="font-medium">{family.category_name}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="bg-cream-100 px-4 py-2 rounded-lg">
                    <span className="text-sm font-semibold text-slate-800">
                      {productCount} {productCount === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>
                  {family.catalog_pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(resolveFileUrl(family.catalog_pdf_url), '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Product Family Catalog
                    </Button>
                  )}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Products in {family.name}
                </h2>
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
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
                    className={`p-2 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={handleQuickView}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-md border border-cream-200 p-4 sm:p-6 flex flex-col md:flex-row gap-4 sm:gap-6 hover:shadow-lg transition-shadow"
                >
                  {/* Product Image */}
                  <div className="w-full md:w-40 h-40 flex-shrink-0 mx-auto md:mx-0">
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

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      {product.base_price ? (
                        <span className="text-xl sm:text-2xl font-bold text-slate-900">
                          ${(product.base_price / 100).toFixed(2)}
                          <span className="text-sm font-normal text-slate-500 ml-1">Est. listing</span>
                        </span>
                      ) : null}

                      <div className="flex flex-col sm:flex-row gap-2">
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
