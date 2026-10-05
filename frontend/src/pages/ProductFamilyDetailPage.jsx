import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Grid3x3, List } from 'lucide-react';
import QuickViewModal from '../components/ui/QuickViewModal';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductCard from '../components/ui/ProductCard';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import SEOHead from '../components/SEOHead';
import { shareImageUrl } from '../config/site';
import { familySeo } from '../utils/seoSchema';
import productService from '../services/productService';
import { resolveFileUrl, resolveImageUrl } from '../utils/apiHelpers';
import logger from '../utils/logger';
import { trackDownload } from '../utils/analytics';
import PdfPreviewButton from '../components/ui/PdfPreviewButton';

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
  // Families without their own photo show their first product
  const familyImage = family
    ? resolveImageUrl(family.banner_image_url || family.family_image || products[0]?.primary_image_url || '/placeholder.svg')
    : '/placeholder.svg';

  // SEO: same title/description/JSON-LD as the prerendered shell (utils/seoSchema.js)
  const seo = useMemo(() => (family ? familySeo({ ...family, slug: familySlug }, products) : null), [family, familySlug, products]);

  const loadFamily = async () => {
    setLoading(true);
    try {
      // Fetch family details using slug
      const familyResponse = await productService.getFamilyById(familySlug);
      setFamily(familyResponse);

      // Fetch unified members (products + variations) for this family
      const members = await productService.getFamilyMembers(familyResponse.id);
      setProducts(members || []);

      logger.info(CONTEXT, `Loaded family ${familyResponse.name} with ${members?.length || 0} members`);
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
        title={seo.title}
        description={seo.description}
        image={shareImageUrl('family', familySlug)}
        imageAlt={seo.imageAlt}
        url={seo.path}
        structuredData={seo.structuredData}
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
          <div className="flex items-center gap-1.5 whitespace-nowrap min-w-fit">
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
                <ResponsiveImage
                  src={familyImage}
                  sizes="(min-width: 1024px) 320px, 400px"
                  priority
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
                      {productCount} {productCount === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                  {family.catalog_pdf_url && (
                    <PdfPreviewButton
                      url={family.catalog_pdf_url}
                      title={`${family.name} family catalog`}
                      label="View Product Family Catalog"
                      className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-500/10 min-h-[44px] sm:min-h-[40px]"
                      onOpen={() => trackDownload({
                        url: resolveFileUrl(family.catalog_pdf_url),
                        label: `${family.name} family catalog`,
                        type: 'catalog',
                      })}
                    />
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

              {/* Members Grid or List */}
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
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {products.map((item) => {
                    const categoryName = typeof item.category === 'string' ? item.category : item.category?.name;
                    const normalized = {
                      id: item.product_id ?? item.id,
                      slug: item.product_slug ?? item.slug,
                      name: item.name,
                      primary_image_url: item.primary_image_url,
                      variation_id: item.variation_id ?? undefined,
                      variation_has_own_image: item.variation_has_own_image,
                      base_price: item.base_price ?? 0,
                      short_description: item.short_description,
                      category: categoryName,
                      hover_images: item.hover_images,
                      lead_time_days: item.lead_time_days,
                    };
                    const key = item.variation_id ? `var-${item.variation_id}` : `product-${item.product_id ?? item.id}`;
                    return (
                      <ProductCard
                        key={key}
                        product={normalized}
                        onQuickView={handleQuickView}
                        imageSizes="(min-width: 1024px) 480px, 50vw"
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  {products.map((item) => {
                    const categoryName = typeof item.category === 'string' ? item.category : item.category?.name;
                    const normalized = {
                      id: item.product_id ?? item.id,
                      slug: item.product_slug ?? item.slug,
                      name: item.name,
                      primary_image_url: item.primary_image_url,
                      variation_id: item.variation_id ?? undefined,
                      variation_has_own_image: item.variation_has_own_image,
                      base_price: item.base_price ?? 0,
                      short_description: item.short_description,
                      category: categoryName,
                      hover_images: item.hover_images,
                      lead_time_days: item.lead_time_days,
                    };
                    const key = item.variation_id ? `var-${item.variation_id}` : `product-${item.product_id ?? item.id}`;
                    return (
                      <ProductCard
                        key={key}
                        product={normalized}
                        onQuickView={handleQuickView}
                        compact
                        imageSizes="(min-width: 1024px) 960px, 100vw"
                      />
                    );
                  })}
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
