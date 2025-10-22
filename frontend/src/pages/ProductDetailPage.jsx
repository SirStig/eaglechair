import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductCard from '../components/ui/ProductCard';
import EditableWrapper from '../components/admin/EditableWrapper';
import { useCartStore } from '../store/cartStore';
import { demoProducts, IS_DEMO } from '../data/demoData';
import { updateProduct } from '../services/contentService';
import { useLightTheme } from '../utils/themeTransition';
import logger from '../utils/logger';

const CONTEXT = 'ProductDetailPage';

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem } = useCartStore();
  const customizeRef = useRef(null);
  const shouldBeLightTheme = useLightTheme(location.pathname);
  const [isLightTheme, setIsLightTheme] = useState(false);
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(null);
  const [selectedUpholstery, setSelectedUpholstery] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    
    if (IS_DEMO) {
      const foundProduct = demoProducts.find(p => p.id === parseInt(id) || p.slug === id);
      
      if (foundProduct) {
        setProduct(foundProduct);
        logger.info(CONTEXT, `Loaded product: ${foundProduct.name}`);
        
        // Find related products in same category
        const related = demoProducts
          .filter(p => p.category === foundProduct.category && p.id !== foundProduct.id)
          .slice(0, 4);
        setRelatedProducts(related);
        
        // Initialize selections
        if (foundProduct.customizations?.finishes?.[0]) {
          setSelectedFinish(foundProduct.customizations.finishes[0]);
        }
        if (foundProduct.customizations?.fabrics?.[0]) {
          setSelectedUpholstery(foundProduct.customizations.fabrics[0]);
        }
      } else {
        navigate('/products');
      }
      setLoading(false);
    } else {
      try {
        const response = await fetch(`/api/v1/products/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data.product);
          setRelatedProducts(data.related || []);
        } else {
          navigate('/products');
        }
      } catch (error) {
        logger.error(CONTEXT, 'Error loading product:', error);
        navigate('/products');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddToCart = () => {
    const customizations = {
      finish: selectedFinish,
      upholstery: selectedUpholstery,
    };
    addItem(product, quantity, customizations);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    logger.info(CONTEXT, `Added to cart: ${product.name} x${quantity}`);
  };

  const scrollToCustomize = () => {
    customizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description,
          url: url,
        });
      } catch (error) {
        logger.debug(CONTEXT, 'Share cancelled or failed', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleDownloadImage = () => {
    const imageUrl = product.images?.[selectedImage] || product.image;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${product.slug || product.name}.jpg`;
    link.click();
  };

  // Product update handler
  const handleUpdateProduct = async (updates) => {
    try {
      logger.info(CONTEXT, `Updating product ${product.id}`);
      await updateProduct(product.id, updates);
      // Reload product
      loadProduct();
      logger.info(CONTEXT, 'Product updated successfully');
    } catch (error) {
      logger.error(CONTEXT, 'Failed to update product', error);
      throw error;
    }
  };

  // Theme transition effect - delay light theme activation for smooth transition
  useEffect(() => {
    if (shouldBeLightTheme) {
      const timer = setTimeout(() => {
        setIsLightTheme(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsLightTheme(false);
    }
  }, [shouldBeLightTheme]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-[1500ms] ${
        isLightTheme ? 'bg-gradient-to-br from-cream-50 to-cream-100' : 'bg-dark-800'
      }`}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-[1500ms] ${
        isLightTheme ? 'bg-gradient-to-br from-cream-50 to-cream-100' : 'bg-dark-800'
      }`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${isLightTheme ? 'text-slate-800' : 'text-dark-50'}`}>Product Not Found</h2>
          <Button onClick={() => navigate('/products')}>Back to Products</Button>
        </div>
      </div>
    );
  }

  const images = product.images || [product.image];

  return (
    <div className={`min-h-screen transition-colors duration-[1500ms] ${
      isLightTheme ? 'bg-gradient-to-br from-cream-50 to-cream-100' : 'bg-dark-800'
    }`}>
      {/* Success Message */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            Added to cart successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className={`border-b transition-colors duration-[1500ms] ${
        isLightTheme ? 'bg-cream-50/50 border-cream-200' : 'bg-dark-900 border-dark-700'
      }`}>
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Breadcrumb */}
          <div className={`mb-6 text-sm ${isLightTheme ? 'text-slate-600' : 'text-dark-100'}`}>
            <Link to="/" className="hover:text-primary-500">Home</Link>
            {' '}/{' '}
            <Link to="/products" className="hover:text-primary-500">Products</Link>
            {' '}/{' '}
            <Link to={`/products?category=${product.category}`} className="hover:text-primary-500">
              {product.category}
            </Link>
            {' '}/{' '}
            <span className={isLightTheme ? 'text-slate-800' : 'text-dark-50'}>{product.name}</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Image Gallery */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block">
                {/* Main Image */}
                <div className="bg-\ rounded-xl overflow-hidden border border-\">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="h-auto object-contain"
                    style={{ maxHeight: '600px', width: 'auto' }}
                  />
                </div>

                {/* Gallery Navigation */}
                {images.length > 1 && (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-dark-900/80 hover:bg-dark-900 border border-dark-600 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-dark-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-dark-900/80 hover:bg-dark-900 border border-dark-600 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-dark-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-dark-900/80 border border-dark-600 rounded-full text-sm text-dark-50">
                      {selectedImage + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.isNew && <Badge variant="success">New</Badge>}
                {product.featured && <Badge variant="primary">Featured</Badge>}
                {product.is_outdoor_suitable && <Badge variant="info">Outdoor</Badge>}
                {product.stock_status && (
                  <Badge variant={product.stock_status === 'In Stock' ? 'success' : 'warning'}>
                    {product.stock_status}
                  </Badge>
                )}
                {product.ada_compliant && <Badge variant="primary">ADA Compliant</Badge>}
              </div>

              {/* Title */}
              <EditableWrapper
                id={`product-title-${product.id}`}
                type="text"
                data={{ name: product.name }}
                onSave={handleUpdateProduct}
                label="Product Name"
              >
                <h1 className="text-4xl font-bold text-dark-50 mb-3">{product.name}</h1>
              </EditableWrapper>
              
              {/* Model Number */}
              {product.model_number && (
                <EditableWrapper
                  id={`product-model-${product.id}`}
                  type="text"
                  data={{ model_number: product.model_number }}
                  onSave={handleUpdateProduct}
                  label="Model Number"
                >
                  <p className="text-lg text-dark-200 mb-6">Model: {product.model_number}</p>
                </EditableWrapper>
              )}

              {/* Description */}
              <EditableWrapper
                id={`product-description-${product.id}`}
                type="textarea"
                data={{
                  short_description: product.short_description,
                  full_description: product.full_description,
                  description: product.description
                }}
                onSave={handleUpdateProduct}
                label="Product Description"
              >
                <div className="text-dark-100 leading-relaxed space-y-4 mb-6">
                  {product.short_description && (
                    <p className="text-lg">{product.short_description}</p>
                  )}
                  {product.full_description && (
                    <p>{product.full_description}</p>
                  )}
                  {!product.short_description && !product.full_description && product.description && (
                    <p>{product.description}</p>
                  )}
                </div>
              </EditableWrapper>

              {/* Customize Now Button */}
              <Button
                variant="primary"
                className="w-full text-base py-3 px-6"
                onClick={scrollToCustomize}
              >
                Customize Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications & Resources */}
      <section className="bg-dark-800 border-b border-dark-700">
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          <h2 className="text-3xl font-bold text-dark-50 mb-8">Specifications & Details</h2>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-dark-50 mb-4">Features</h3>
                <ul className="space-y-2 text-dark-100 text-base">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-primary-500 mr-2 mt-1">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Available Variations */}
            {(product.customizations?.finishes || product.customizations?.fabrics || product.customizations?.colors) && (
              <div>
                <h3 className="text-xl font-semibold text-dark-50 mb-4">Available Variations</h3>
                <div className="space-y-2.5 text-dark-100 text-base">
                  {product.customizations.finishes && (
                    <div>
                      <span className="font-medium text-dark-50">Finishes:</span>
                      <p className="mt-1">{product.customizations.finishes.join(', ')}</p>
                    </div>
                  )}
                  {product.customizations.fabrics && (
                    <div>
                      <span className="font-medium text-dark-50">Upholstery:</span>
                      <p className="mt-1">{product.customizations.fabrics.join(', ')}</p>
                    </div>
                  )}
                  {product.customizations.colors && (
                    <div>
                      <span className="font-medium text-dark-50">Colors:</span>
                      <p className="mt-1">{product.customizations.colors.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dimensions & Weight */}
            <div>
              <h3 className="text-xl font-semibold text-dark-50 mb-4">Dimensions & Weight</h3>
              <div className="space-y-2 text-dark-100 text-base">
                {product.width && (
                  <div className="flex justify-between">
                    <span>Width:</span>
                    <span className="font-medium text-dark-50">{product.width}"</span>
                  </div>
                )}
                {product.depth && (
                  <div className="flex justify-between">
                    <span>Depth:</span>
                    <span className="font-medium text-dark-50">{product.depth}"</span>
                  </div>
                )}
                {product.height && (
                  <div className="flex justify-between">
                    <span>Height:</span>
                    <span className="font-medium text-dark-50">{product.height}"</span>
                  </div>
                )}
                {product.seat_width && (
                  <div className="flex justify-between">
                    <span>Seat Width:</span>
                    <span className="font-medium text-dark-50">{product.seat_width}"</span>
                  </div>
                )}
                {product.seat_depth && (
                  <div className="flex justify-between">
                    <span>Seat Depth:</span>
                    <span className="font-medium text-dark-50">{product.seat_depth}"</span>
                  </div>
                )}
                {product.seat_height && (
                  <div className="flex justify-between">
                    <span>Seat Height:</span>
                    <span className="font-medium text-dark-50">{product.seat_height}"</span>
                  </div>
                )}
                {product.arm_height && (
                  <div className="flex justify-between">
                    <span>Arm Height:</span>
                    <span className="font-medium text-dark-50">{product.arm_height}"</span>
                  </div>
                )}
                {product.back_height && (
                  <div className="flex justify-between">
                    <span>Back Height:</span>
                    <span className="font-medium text-dark-50">{product.back_height}"</span>
                  </div>
                )}
                {product.weight && (
                  <div className="flex justify-between">
                    <span>Weight:</span>
                    <span className="font-medium text-dark-50">{product.weight} lbs</span>
                  </div>
                )}
                {product.shipping_weight && (
                  <div className="flex justify-between">
                    <span>Ship Weight:</span>
                    <span className="font-medium text-dark-50">{product.shipping_weight} lbs</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Additional Details Row */}
          <div className="grid lg:grid-cols-3 gap-8 mt-8 pt-8 border-t border-dark-700">
            {/* Construction Details */}
            {product.construction_details && (
              <div>
                <h3 className="text-xl font-semibold text-dark-50 mb-3">Construction</h3>
                <p className="text-dark-100 text-base leading-relaxed">{product.construction_details}</p>
              </div>
            )}

            {/* Care & Warranty */}
            <div>
              {product.care_instructions && (
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-dark-50 mb-3">Care Instructions</h3>
                  <p className="text-dark-100 text-base leading-relaxed">{product.care_instructions}</p>
                </div>
              )}
              {product.warranty_info && (
                <div>
                  <h3 className="text-xl font-semibold text-dark-50 mb-3">Warranty</h3>
                  <p className="text-dark-100 text-base leading-relaxed">{product.warranty_info}</p>
                </div>
              )}
            </div>

            {/* Certifications & Resources */}
            <div>
              {(product.flame_certifications || product.green_certifications || product.ada_compliant) && (
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-dark-50 mb-3">Certifications</h3>
                  <div className="space-y-1.5 text-dark-100 text-base">
                    {product.flame_certifications && (
                      <p>{product.flame_certifications.join(', ')}</p>
                    )}
                    {product.green_certifications && (
                      <p>{product.green_certifications.join(', ')}</p>
                    )}
                    {product.ada_compliant && (
                      <p>ADA Compliant</p>
                    )}
                  </div>
                </div>
              )}
              {(product.spec_sheet_url || product.dimensional_drawing_url || product.cad_file_url) && (
                <div>
                  <h3 className="text-xl font-semibold text-dark-50 mb-3">Resources</h3>
                  <div className="flex flex-col gap-2 text-base">
                    {product.spec_sheet_url && (
                      <a href={product.spec_sheet_url} download className="text-primary-500 hover:text-primary-400 underline">
                        Spec Sheet
                      </a>
                    )}
                    {product.dimensional_drawing_url && (
                      <a href={product.dimensional_drawing_url} download className="text-primary-500 hover:text-primary-400 underline">
                        Dimensional Drawing
                      </a>
                    )}
                    {product.cad_file_url && (
                      <a href={product.cad_file_url} download className="text-primary-500 hover:text-primary-400 underline">
                        CAD File
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Customize & Quote Section */}
      <section ref={customizeRef} className="bg-dark-900 border-b border-dark-700 scroll-mt-20">
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          <h2 className="text-3xl font-bold text-dark-50 mb-8">Customize & Request Quote</h2>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* 3D Model Placeholder / Product Image */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block">
                <div className="bg-\ rounded-xl overflow-hidden border border-\">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="h-auto object-contain"
                    style={{ maxHeight: '600px', width: 'auto' }}
                  />
                  
                  {/* 3D Coming Soon Badge */}
                  <div className="absolute bottom-12 left-4 right-4 bg-dark-900/90 backdrop-blur-sm border border-primary-500 rounded-lg p-3 text-center">
                    <p className="text-primary-400 font-semibold text-sm">3D Customization Coming Soon</p>
                    <p className="text-dark-200 text-xs mt-1">Interactive 3D model viewer in development</p>
                  </div>
                </div>

                {/* Gallery Navigation */}
                {images.length > 1 && (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-dark-900/80 hover:bg-dark-900 border border-dark-600 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-dark-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-dark-900/80 hover:bg-dark-900 border border-dark-600 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-dark-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-dark-900/80 border border-dark-600 rounded-full text-sm text-dark-50">
                      {selectedImage + 1} / {images.length}
                    </div>
                  </>
                )}

                {/* Image Actions */}
                <div className="flex items-center justify-center gap-6 text-sm mt-3">
                  <button
                    onClick={handleDownloadImage}
                    className="text-primary-500 hover:text-primary-400 underline transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Image
                  </button>
                  <button
                    onClick={handleShare}
                    className="text-primary-500 hover:text-primary-400 underline transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share Product
                  </button>
                </div>
              </div>
            </div>

            {/* Customization Options */}
            <div>
              {/* Finishes */}
              {product.customizations?.finishes && product.customizations.finishes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-3">
                    Select Finish
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {product.customizations.finishes.map((finish, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFinish(finish)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          selectedFinish === finish
                            ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                            : 'border-dark-600 bg-dark-800 text-dark-100 hover:border-dark-500'
                        }`}
                      >
                        {finish}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upholstery/Fabrics */}
              {product.customizations?.fabrics && product.customizations.fabrics.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-3">
                    Select Upholstery
                  </label>
                  <select
                    value={selectedUpholstery || ''}
                    onChange={(e) => setSelectedUpholstery(e.target.value)}
                    className="w-full px-4 py-3 border border-dark-600 bg-dark-800 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a fabric</option>
                    {product.customizations.fabrics.map((fabric, idx) => (
                      <option key={idx} value={fabric}>{fabric}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Colors (if different from finishes) */}
              {product.customizations?.colors && product.customizations.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-dark-100 mb-3">
                    Select Color
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {product.customizations.colors.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFinish(color)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          selectedFinish === color
                            ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                            : 'border-dark-600 bg-dark-800 text-dark-100 hover:border-dark-500'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-100 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 flex items-center justify-center bg-dark-800 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors text-dark-50 font-bold text-xl"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 h-12 text-center border border-dark-600 bg-dark-800 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-semibold text-lg"
                    min="1"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 flex items-center justify-center bg-dark-800 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors text-dark-50 font-bold text-xl"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full text-base py-3 px-6"
                  onClick={handleAddToCart}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Add {quantity} to Cart
                </Button>

                <Button
                  variant="outline"
                  className="w-full text-base py-3 px-6"
                  onClick={() => navigate('/quote')}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Request Custom Quote
                </Button>
              </div>

              {/* Lead Time */}
              {product.lead_time_days && (
                <p className="text-sm text-dark-200 mt-4 text-center">
                  Estimated Lead Time: {product.lead_time_days} days
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="bg-dark-800">
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <h2 className="text-3xl font-bold text-dark-50 mb-8">Recommended Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailPage;
