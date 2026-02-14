import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import QuickViewModal from '../components/ui/QuickViewModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SEOHead from '../components/SEOHead';
import productService from '../services/productService';
import { buildProductUrl } from '../utils/apiHelpers';
import logger from '../utils/logger';

const CONTEXT = 'RelatedProductsPage';

const RelatedProductsPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  useEffect(() => {
    if (productId) load();
  }, [productId]);

  const load = async () => {
    setLoading(true);
    try {
      const id = parseInt(productId, 10);
      if (Number.isNaN(id)) {
        navigate('/products');
        return;
      }
      const [productRes, related] = await Promise.all([
        productService.getProductById(id),
        productService.getRelatedProducts(id, 100)
      ]);
      setProduct(productRes.data);
      setProducts(related || []);
    } catch (e) {
      logger.error(CONTEXT, 'Failed to load related products', e);
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickView = (p) => setQuickViewProduct(p);

  if (loading) {
    return (
      <div className="min-h-screen py-12 bg-cream-50">
        <div className="container mx-auto px-4 max-w-7xl flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const productName = product?.name || 'Product';
  const backUrl = product ? buildProductUrl(product) : `/products/${productId}`;

  return (
    <div className="min-h-screen py-12 bg-cream-50">
      <SEOHead
        title={`Related Products – ${productName} | Eagle Chair`}
        description={`Explore products related to ${productName}. Commercial seating solutions from Eagle Chair.`}
      />
      <div className="container mx-auto px-4 max-w-7xl">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {productName}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
          Recommended Products
        </h1>
        <p className="text-slate-600 mb-8">
          {products.length} product{products.length !== 1 ? 's' : ''} related to {productName}
        </p>
        {products.length === 0 ? (
          <p className="text-slate-600">No related products found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={handleQuickView}
              />
            ))}
          </div>
        )}
      </div>
      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
};

export default RelatedProductsPage;
