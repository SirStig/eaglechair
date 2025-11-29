import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductCard from '../components/ui/ProductCard';
import EditableWrapper from '../components/admin/EditableWrapper';
import { useCartStore } from '../store/cartStore';
import { updateProduct } from '../services/contentService';
import productService from '../services/productService';
import { getProductImages, resolveImageUrl } from '../utils/apiHelpers';
import { useToast } from '../contexts/ToastContext';
import logger from '../utils/logger';

const CONTEXT = 'ProductDetailPage';

const ProductDetailPage = () => {
  const { id, categorySlug, subcategorySlug, productSlug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const customizeRef = useRef(null);
  const toast = useToast();
  // Always use light theme on product pages
  const isLightTheme = true;
  
  // Determine product identifier - priority: productSlug > id
  const productId = productSlug || id;
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(null);
  const [selectedUpholstery, setSelectedUpholstery] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [loadingVariations, setLoadingVariations] = useState(false);

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Reset image index when variation changes
  useEffect(() => {
    if (selectedVariation) {
      setSelectedImage(0);
    }
  }, [selectedVariation]);

  // Get images - use variation images if variation is selected, otherwise product images
  // Use useMemo to ensure stable reference and avoid hooks order issues
  const images = useMemo(() => {
    if (!product) return [];
    if (selectedVariation && selectedVariation.images) {
      // Ensure images is an array
      let imagesArray = selectedVariation.images;
      if (typeof imagesArray === 'string') {
        try {
          imagesArray = JSON.parse(imagesArray);
        } catch (e) {
          imagesArray = [];
        }
      }
      if (Array.isArray(imagesArray) && imagesArray.length > 0) {
        return imagesArray.map(img => {
          if (typeof img === 'string') return resolveImageUrl(img);
          return resolveImageUrl(img.url || img);
        });
      }
    }
    if (selectedVariation && selectedVariation.primary_image_url) {
      return [resolveImageUrl(selectedVariation.primary_image_url)];
    }
    return getProductImages(product);
  }, [product, selectedVariation]);

  // Preload first product image when product or variation changes
  useEffect(() => {
    if (product && images && images.length > 0) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = images[0];
      document.head.appendChild(link);
      
      return () => {
        // Cleanup: remove preload link when component unmounts or product changes
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [product, images]);

  const loadProduct = async () => {
    setLoading(true);
    
    try {
      logger.info(CONTEXT, `Loading product with ID/slug: ${productId}`);
      
      // Use productService which handles both demo and real API modes
      const response = await productService.getProductById(productId);
      
      logger.debug(CONTEXT, 'Product service response:', response);
      
      if (response && response.data) {
        setProduct(response.data);
        setRelatedProducts(response.related || []);
        
        logger.info(CONTEXT, `Successfully loaded product: ${response.data.name}`);
        
        // Initialize selections
        if (response.data.customizations?.finishes?.[0]) {
          setSelectedFinish(response.data.customizations.finishes[0]);
        } else if (response.data.customizations?.colors?.[0]) {
          setSelectedFinish(response.data.customizations.colors[0]);
        }
        
        if (response.data.customizations?.fabrics?.[0]) {
          setSelectedUpholstery(response.data.customizations.fabrics[0]);
        } else         if (response.data.customizations?.upholstery?.[0]) {
          setSelectedUpholstery(response.data.customizations.upholstery[0]);
        }
        
        // Fetch variations
        if (response.data.id) {
          setLoadingVariations(true);
          logger.info(CONTEXT, `Fetching variations for product ID: ${response.data.id}`);
          productService.getProductVariations(response.data.id)
            .then((vars) => {
              logger.info(CONTEXT, `Loaded ${vars?.length || 0} variations`, vars);
              setVariations(vars || []);
              if (vars && vars.length > 0) {
                setSelectedVariation(vars[0]);
                logger.info(CONTEXT, `Selected first variation: ${vars[0].sku || vars[0].id}`);
              }
            })
            .catch((error) => {
              logger.error(CONTEXT, 'Failed to load variations', error);
              setVariations([]);
            })
            .finally(() => {
              setLoadingVariations(false);
            });
        } else {
          logger.warn(CONTEXT, 'Product has no ID, cannot fetch variations');
        }
      } else {
        logger.warn(CONTEXT, `Product not found: ${productId}`, response);
        navigate('/products');
      }
    } catch (error) {
      logger.error(CONTEXT, `Error loading product ${productId}:`, error);
      // Don't navigate away immediately if it's just a network error
      // Only navigate if product truly doesn't exist (404)
      if (error.status === 404 || error.message?.includes('not found')) {
        navigate('/products');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    const customizations = {
      finish: selectedFinish,
      upholstery: selectedUpholstery,
      variation: selectedVariation,
    };
    addItem(product, quantity, customizations);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
    logger.info(CONTEXT, `Added to cart: ${product.name} x${quantity}${selectedVariation ? ` (variation: ${selectedVariation.sku})` : ''}`);
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
      toast.success('Link copied to clipboard!');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream-50 to-cream-100">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`min-h-screen flex items-center justify-center  ${
        'bg-gradient-to-br from-cream-50 to-cream-100'
      }`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Product Not Found</h2>
          <Button onClick={() => navigate('/products')}>Back to Products</Button>
        </div>
      </div>
    );
  }


  return (
    <div className={`min-h-screen  ${
      'bg-gradient-to-br from-cream-50 to-cream-100'
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
      <section className={`border-b  ${
        'bg-cream-50/50 border-cream-200'
      }`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12">
          {/* Breadcrumb */}
          <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600">
            <Link to="/" className="hover:text-primary-500">Home</Link>
            {' '}/{' '}
            <Link to="/products" className="hover:text-primary-500">Products</Link>
            {product.category && (
              <>
                {' '}/{' '}
                <Link 
                  to={typeof product.category === 'object' && product.category.slug 
                    ? `/products/category/${product.category.parent_slug || product.category.slug}`
                    : '/products'
                  } 
                  className="hover:text-primary-500"
                >
                  {typeof product.category === 'object' ? product.category.name : product.category}
                </Link>
              </>
            )}
            {' '}/{' '}
            <span className={isLightTheme ? 'text-slate-800' : 'text-slate-800'}>{product.name}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
            {/* Image Gallery */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block w-full">
                {/* Main Image */}
                <div className="bg-white rounded-xl overflow-hidden border border-cream-200">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '500px', mixBlendMode: 'multiply' }}
                  />
                </div>

                {/* Gallery Navigation */}
                {images.length > 1 && (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1)}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors min-w-[44px] min-h-[44px] z-10"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors min-w-[44px] min-h-[44px] z-10"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-cream-50/80 border border-cream-300 rounded-full text-sm text-slate-800">
                      {selectedImage + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div>
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.isNew && <Tag variant="new">New</Tag>}
                {product.featured && <Tag variant="featured">Featured</Tag>}
                {product.is_outdoor_suitable && <Tag variant="default">Outdoor</Tag>}
                {product.stock_status && (
                  <Tag variant={product.stock_status === 'In Stock' ? 'new' : 'limited'}>
                    {product.stock_status}
                  </Tag>
                )}
                {product.ada_compliant && <Tag variant="commercial">ADA Compliant</Tag>}
                {product.tags?.map((tag) => (
                  <Tag key={tag} variant="commercial">{tag}</Tag>
                ))}
              </div>

              {/* Title */}
              <EditableWrapper
                id={`product-title-${product.id}`}
                type="text"
                data={{ name: product.name }}
                onSave={handleUpdateProduct}
                label="Product Name"
              >
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-3">{product.name}</h1>
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
                  <p className="text-lg text-slate-600 mb-6">Model: {product.model_number}</p>
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
                <div className="text-slate-700 leading-relaxed space-y-4 mb-6">
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
      <section className="bg-white border-b border-cream-200">
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8">Specifications & Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Features</h3>
                <ul className="space-y-2 text-slate-700 text-base">
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
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Available Variations</h3>
                <div className="space-y-2.5 text-slate-700 text-base">
                  {product.customizations.finishes && (
                    <div>
                      <span className="font-medium text-slate-800">Finishes:</span>
                      <p className="mt-1">{product.customizations.finishes.join(', ')}</p>
                    </div>
                  )}
                  {product.customizations.fabrics && (
                    <div>
                      <span className="font-medium text-slate-800">Upholstery:</span>
                      <p className="mt-1">{product.customizations.fabrics.join(', ')}</p>
                    </div>
                  )}
                  {product.customizations.colors && (
                    <div>
                      <span className="font-medium text-slate-800">Colors:</span>
                      <p className="mt-1">{product.customizations.colors.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dimensions & Weight */}
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Dimensions & Weight</h3>
              <div className="space-y-2 text-slate-700 text-base">
                {product.width && (
                  <div className="flex justify-between">
                    <span>Width:</span>
                    <span className="font-medium text-slate-800">{product.width}"</span>
                  </div>
                )}
                {product.depth && (
                  <div className="flex justify-between">
                    <span>Depth:</span>
                    <span className="font-medium text-slate-800">{product.depth}"</span>
                  </div>
                )}
                {product.height && (
                  <div className="flex justify-between">
                    <span>Height:</span>
                    <span className="font-medium text-slate-800">{product.height}"</span>
                  </div>
                )}
                {product.seat_width && (
                  <div className="flex justify-between">
                    <span>Seat Width:</span>
                    <span className="font-medium text-slate-800">{product.seat_width}"</span>
                  </div>
                )}
                {product.seat_depth && (
                  <div className="flex justify-between">
                    <span>Seat Depth:</span>
                    <span className="font-medium text-slate-800">{product.seat_depth}"</span>
                  </div>
                )}
                {product.seat_height && (
                  <div className="flex justify-between">
                    <span>Seat Height:</span>
                    <span className="font-medium text-slate-800">{product.seat_height}"</span>
                  </div>
                )}
                {product.arm_height && (
                  <div className="flex justify-between">
                    <span>Arm Height:</span>
                    <span className="font-medium text-slate-800">{product.arm_height}"</span>
                  </div>
                )}
                {product.back_height && (
                  <div className="flex justify-between">
                    <span>Back Height:</span>
                    <span className="font-medium text-slate-800">{product.back_height}"</span>
                  </div>
                )}
                {product.weight && (
                  <div className="flex justify-between">
                    <span>Weight:</span>
                    <span className="font-medium text-slate-800">{product.weight} lbs</span>
                  </div>
                )}
                {product.shipping_weight && (
                  <div className="flex justify-between">
                    <span>Ship Weight:</span>
                    <span className="font-medium text-slate-800">{product.shipping_weight} lbs</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Additional Details Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-cream-200">
            {/* Construction Details */}
            {product.construction_details && (
              <div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">Construction</h3>
                <p className="text-slate-700 text-base leading-relaxed">{product.construction_details}</p>
              </div>
            )}

            {/* Care & Warranty */}
            <div>
              {product.care_instructions && (
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">Care Instructions</h3>
                  <p className="text-slate-700 text-base leading-relaxed">{product.care_instructions}</p>
                </div>
              )}
              {product.warranty_info && (
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">Warranty</h3>
                  <p className="text-slate-700 text-base leading-relaxed">{product.warranty_info}</p>
                </div>
              )}
            </div>

            {/* Certifications & Resources */}
            <div>
              {(product.flame_certifications || product.green_certifications || product.ada_compliant) && (
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">Certifications</h3>
                  <div className="space-y-1.5 text-slate-700 text-base">
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
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">Resources</h3>
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
      <section ref={customizeRef} className="bg-cream-50 border-b border-cream-200 scroll-mt-20">
        <div className="container mx-auto px-4 py-12 sm:py-16 max-w-7xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8">Customize & Request Quote</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* 3D Model Placeholder / Product Image */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block">
                <div className="bg-white rounded-xl overflow-hidden border border-cream-200">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '500px', mixBlendMode: 'multiply' }}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                  
                  {/* 3D Coming Soon Badge */}
                  <div className="absolute bottom-12 left-4 right-4 bg-cream-50/90 backdrop-blur-sm border border-primary-500 rounded-lg p-3 text-center">
                    <p className="text-primary-400 font-semibold text-sm">3D Customization Coming Soon</p>
                    <p className="text-slate-600 text-xs mt-1">Interactive 3D model viewer in development</p>
                  </div>
                </div>

                {/* Gallery Navigation */}
                {images.length > 1 && (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={() => setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-cream-50/80 border border-cream-300 rounded-full text-sm text-slate-800">
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
              {/* Variations Selection */}
              {variations.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Product Variations {loadingVariations && <span className="text-xs text-slate-400">(Loading...)</span>}
                  </label>
                  <select
                    value={selectedVariation?.id || ''}
                    onChange={(e) => {
                      const variation = variations.find(v => v.id === parseInt(e.target.value));
                      setSelectedVariation(variation || null);
                      setSelectedImage(0); // Reset image when variation changes
                    }}
                    className="w-full px-4 py-3 text-base border-2 border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={loadingVariations}
                  >
                    <option value="">Select a variation...</option>
                    {variations.map((variation) => {
                      // Build variation display name with SKU and specifications
                      const parts = [];
                      if (variation.sku) {
                        parts.push(variation.sku);
                      }
                      const details = [
                        variation.finish?.name,
                        variation.upholstery?.name,
                        variation.color?.name
                      ].filter(Boolean);
                      if (details.length > 0) {
                        parts.push(`(${details.join(' / ')})`);
                      }
                      const variationName = parts.join(' ') || `Variation #${variation.id}`;
                      
                      return (
                        <option key={variation.id} value={variation.id}>
                          {variationName}
                        </option>
                      );
                    })}
                  </select>
                  {selectedVariation && (
                    <div className="mt-4 p-4 bg-cream-50 rounded-lg border border-cream-200 space-y-3">
                      {/* Variation Details */}
                      <div className="text-sm text-slate-700 space-y-2">
                        {selectedVariation.sku && (
                          <div>
                            <span className="font-semibold">Model/SKU:</span> {selectedVariation.sku}
                          </div>
                        )}
                        {(selectedVariation.finish || selectedVariation.upholstery || selectedVariation.color) && (
                          <div>
                            <span className="font-semibold">Specifications:</span>
                            <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                              {selectedVariation.finish?.name && (
                                <li>Finish: {selectedVariation.finish.name}</li>
                              )}
                              {selectedVariation.upholstery?.name && (
                                <li>Upholstery: {selectedVariation.upholstery.name}</li>
                              )}
                              {selectedVariation.color?.name && (
                                <li>Color: {selectedVariation.color.name}</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                      {/* Stock Status & Lead Time */}
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-cream-200">
                        {selectedVariation.stock_status && (
                          <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                            selectedVariation.stock_status === 'Available' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedVariation.stock_status}
                          </span>
                        )}
                        {selectedVariation.lead_time_days && (
                          <span className="text-xs text-slate-600">Lead time: {selectedVariation.lead_time_days} days</span>
                        )}
                        {selectedVariation.price_adjustment !== undefined && selectedVariation.price_adjustment !== 0 && (
                          <span className="text-xs font-medium text-slate-700">
                            Price adjustment: {selectedVariation.price_adjustment > 0 ? '+' : ''}
                            ${(selectedVariation.price_adjustment / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Finishes */}
              {product.customizations?.finishes && product.customizations.finishes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Finish
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {product.customizations.finishes.map((finish, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFinish(finish)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px] ${
                          selectedFinish === finish
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-cream-300 bg-white text-slate-700 hover:border-primary-400'
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
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Upholstery
                  </label>
                  <select
                    value={selectedUpholstery || ''}
                    onChange={(e) => setSelectedUpholstery(e.target.value)}
                    className="w-full px-4 py-3 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Color
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {product.customizations.colors.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFinish(color)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px] ${
                          selectedFinish === color
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-cream-300 bg-white text-slate-700 hover:border-primary-400'
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
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white border border-cream-300 rounded-lg hover:bg-cream-100 transition-colors text-slate-800 font-bold text-xl min-w-[48px] min-h-[48px]"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 sm:w-24 h-12 sm:h-14 text-center border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-semibold text-base sm:text-lg"
                    min="1"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white border border-cream-300 rounded-lg hover:bg-cream-100 transition-colors text-slate-800 font-bold text-xl min-w-[48px] min-h-[48px]"
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
                <p className="text-sm text-slate-600 mt-4 text-center">
                  Estimated Lead Time: {product.lead_time_days} days
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="bg-white">
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8">Recommended Products</h2>
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



