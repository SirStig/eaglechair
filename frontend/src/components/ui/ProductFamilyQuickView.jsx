import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import ProductCard from './ProductCard';
import LoadingSpinner from './LoadingSpinner';
import productService from '../../services/productService';

/**
 * ProductFamilyQuickView Modal
 * 
 * Quick preview of a product family with:
 * - Family banner image
 * - Name and description
 * - Grid of products in the family (first 6)
 * - Link to full family detail page
 */
const ProductFamilyQuickView = ({ family, isOpen, onClose }) => {
  const [familyProducts, setFamilyProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load products for this family
  useEffect(() => {
    if (isOpen && family?.id) {
      loadFamilyProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, family?.id]);

  const loadFamilyProducts = async () => {
    setLoading(true);
    try {
      // Fetch products in this family using productService
      const response = await productService.getProducts({
        family_id: family.id,
        per_page: 6, // Show first 6 products
        exclude_variations: true,
      });
      setFamilyProducts(response.data || []);
    } catch (error) {
      console.error('Error loading family products:', error);
      setFamilyProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!family) return null;

  const familyUrl = `/families/${family.slug || family.id}`;
  const productCount = family.product_count || family.products?.length || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors z-10"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>

            {/* Two Column Layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid lg:grid-cols-[400px_1fr] gap-6 p-6">
                {/* Left Column - Family Image and Info */}
                <div className="space-y-4">
                  {/* Banner Image - Portrait aspect */}
                  {(family.banner_image_url || family.family_image) && (
                    <div className="relative w-full aspect-[3/4] overflow-hidden bg-cream-100 rounded-lg">
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
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">
                      {family.name}
                    </h2>
                    {family.category_name && (
                      <p className="text-sm text-slate-500 uppercase tracking-wider mb-3">
                        {family.category_name}
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
                    <div>
                      <p className="text-slate-700 leading-relaxed">
                        {family.overview_text || family.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column - Products */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">
                      Products in this Family
                    </h3>
                    {productCount > 6 && (
                      <Link
                        to={familyUrl}
                        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        View all {productCount} products
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : familyProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      No products found in this family
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {familyProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onQuickView={() => {}} // Disable nested quick view
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-cream-200 p-6 bg-cream-50">
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  Close
                </Button>
                <Link to={familyUrl}>
                  <Button variant="primary">
                    View Full Family Details
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProductFamilyQuickView;
