import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductCard from '../components/ui/ProductCard';
import ProductCarousel from '../components/ui/ProductCarousel';
import QuickViewModal from '../components/ui/QuickViewModal';
import ImageLightboxModal from '../components/ui/ImageLightboxModal';
import EditableWrapper from '../components/admin/EditableWrapper';
import SEOHead from '../components/SEOHead';
import { useCartStore } from '../store/cartStore';
import { updateProduct } from '../services/contentService';
import productService from '../services/productService';
import { getProductImages, getProductGalleryImages, resolveImageUrl, resolveFileUrl } from '../utils/apiHelpers';
import SwatchImage from '../components/ui/SwatchImage';
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
  const [customizeImageIndex, setCustomizeImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(null);
  const [selectedUpholstery, setSelectedUpholstery] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [familyProducts, setFamilyProducts] = useState([]);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [customNotes, setCustomNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

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

  useEffect(() => {
    setCustomizeImageIndex(0);
  }, [productId]);

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

  const heroImageCount = product ? 1 + (product.hover_images?.length || 0) : 0;
  const carouselImages = images.length > 0 ? images.slice(0, Math.max(1, Math.min(heroImageCount, images.length))) : [];
  const galleryOnlyImages = useMemo(() => (product ? getProductGalleryImages(product) : []), [product]);
  const [gallerySelectedIndex, setGallerySelectedIndex] = useState(0);
  const galleryIntervalRef = useRef(null);

  useEffect(() => {
    setGallerySelectedIndex(0);
  }, [productId]);

  useEffect(() => {
    if (galleryOnlyImages.length <= 1) return;
    galleryIntervalRef.current = setInterval(() => {
      setGallerySelectedIndex(prev => (prev + 1) % galleryOnlyImages.length);
    }, 5000);
    return () => {
      if (galleryIntervalRef.current) clearInterval(galleryIntervalRef.current);
    };
  }, [galleryOnlyImages.length]);

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


  // Generate SEO data
  const seoTitle = product?.meta_title || (product ? `${product.name} | Eagle Chair` : 'Eagle Chair');
  const seoDescription = product?.meta_description || (product?.description ? product.description.substring(0, 160) : (product ? `Shop ${product.name} from Eagle Chair. Premium commercial seating solutions.` : 'Shop Eagle Chair. Premium commercial seating solutions.'));
  const productUrl = categorySlug && subcategorySlug && productSlug
    ? `/products/${categorySlug}/${subcategorySlug}/${productSlug}`
    : (product ? `/products/${product.id}` : '/products');
  const productImage = images && images.length > 0 ? images[0] : (product?.primary_image_url || '/og-image.jpg');

  // Generate structured data (JSON-LD)
  const productSchema = useMemo(() => {
    if (!product) return null;

    const breadcrumbItems = [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.eaglechair.com/" },
      { "@type": "ListItem", "position": 2, "name": "Products", "item": "https://www.eaglechair.com/products" }
    ];

    if (product.category) {
      const categoryName = typeof product.category === 'object' ? product.category.name : product.category;
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": breadcrumbItems.length + 1,
        "name": categoryName,
        "item": `https://www.eaglechair.com/products/category/${categorySlug || product.category.slug || ''}`
      });
    }

    breadcrumbItems.push({
      "@type": "ListItem",
      "position": breadcrumbItems.length + 1,
      "name": product.name,
      "item": `https://www.eaglechair.com${productUrl}`
    });

    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "description": product.description || seoDescription,
      "image": images && images.length > 0 ? images.map(img => `https://www.eaglechair.com${img}`) : [`https://www.eaglechair.com${productImage}`],
      "sku": product.sku || product.model_number || product.id.toString(),
      "brand": {
        "@type": "Brand",
        "name": "Eagle Chair"
      },
      "offers": {
        "@type": "Offer",
        "price": product.base_price || 0,
        "priceCurrency": "USD",
        "availability": product.stock_status === 'In Stock' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "url": `https://www.eaglechair.com${productUrl}`
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems
      }
    };
  }, [product, images, productUrl, categorySlug, seoDescription, productImage]);

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

        // Fetch family members if family_id exists
        if (response.data.family_id) {
          productService.getProducts({
            family_id: response.data.family_id,
            limit: 20
          })
            .then(res => {
              const members = (res.data || []).filter(p => p.id !== response.data.id).slice(0, 20);
              setFamilyProducts(members);
            })
            .catch(err => logger.error(CONTEXT, 'Failed to load family members', err));
        }

        logger.info(CONTEXT, `Successfully loaded product: ${response.data.name}`);

        // Initialize selections
        if (response.data.customizations?.finishes?.[0]) {
          setSelectedFinish(response.data.customizations.finishes[0]);
        } else if (response.data.customizations?.colors?.[0]) {
          setSelectedFinish(response.data.customizations.colors[0]);
        }

        if (response.data.customizations?.fabrics?.[0]) {
          setSelectedUpholstery(response.data.customizations.fabrics[0]);
        } else if (response.data.customizations?.upholstery?.[0]) {
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
      custom_notes: customNotes?.trim() || null,
    };
    addItem(product, quantity, customizations);
    setCustomNotes('');
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

  const handleDownloadImage = (imageUrl) => {
    const url = imageUrl || images[selectedImage] || product.primary_image_url || product.image;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${product.slug || product.name}.jpg`;
    link.click();
  };

  const handleQuickView = (p) => setQuickViewProduct(p);

  const openLightbox = (imageList, initialIdx = 0) => {
    if (!imageList?.length) return;
    setLightboxImages(imageList);
    setLightboxInitialIndex(initialIdx);
    setLightboxOpen(true);
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
      <div className={`min-h-screen flex items-center justify-center  ${'bg-gradient-to-br from-cream-50 to-cream-100'
        }`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Product Not Found</h2>
          <Button onClick={() => navigate('/products')}>Back to Products</Button>
        </div>
      </div>
    );
  }



  return (
    <div className={`min-h-screen  ${'bg-gradient-to-br from-cream-50 to-cream-100'
      }`}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image={productImage}
        url={productUrl}
        type="product"
        keywords={product.meta_keywords || `${product.name}, commercial seating, restaurant chairs, Eagle Chair`}
        canonical={productUrl}
        structuredData={productSchema}
      />
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
      <section className={`border-b  ${'bg-cream-50/50 border-cream-200'
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
            {/* Hero image (primary + hover only) */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block w-full">
                <button
                  type="button"
                  onClick={() => openLightbox(carouselImages, selectedImage)}
                  className="bg-white rounded-xl overflow-hidden border border-cream-200 block w-full cursor-zoom-in hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <img
                    src={carouselImages[Math.min(selectedImage, carouselImages.length - 1)] || carouselImages[0] || images[0]}
                    alt={product.name}
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '500px', mixBlendMode: 'multiply' }}
                    loading={selectedImage === 0 ? "eager" : "lazy"}
                    fetchpriority={selectedImage === 0 ? "high" : "low"}
                    decoding="async"
                  />
                </button>

                {carouselImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(selectedImage === 0 ? carouselImages.length - 1 : selectedImage - 1)}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors min-w-[44px] min-h-[44px] z-10"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(selectedImage === carouselImages.length - 1 ? 0 : selectedImage + 1)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors min-w-[44px] min-h-[44px] z-10"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-cream-50/80 border border-cream-300 rounded-full text-sm text-slate-800">
                      {Math.min(selectedImage, carouselImages.length - 1) + 1} / {carouselImages.length}
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

              {/* Description - full description only; hidden when empty */}
              {(product.full_description || product.description) && (
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
                    <p className="text-base">{product.full_description || product.description}</p>
                  </div>
                </EditableWrapper>
              )}

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

      {/* Features | Weight & Dimensions | Certifications - single clean row */}
      <section className="bg-white border-b border-cream-200">
        <div className="container mx-auto px-4 py-12 sm:py-16 max-w-7xl">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 text-left">
              {/* Features */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-5">Features</h3>
                {product.features && product.features.length > 0 ? (
                  <ul className="space-y-3.5 text-slate-700 text-[15px] leading-relaxed">
                    {product.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-400 mt-0.5">–</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-[15px]">—</p>
                )}
              </div>

              {/* Weight & Dimensions */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-5">Weight & Dimensions</h3>
                <div className="space-y-3.5 text-slate-700 text-[15px] leading-relaxed">
                  {(product.width || product.depth || product.height) && (
                    <p>
                      Overall Dimensions : {[product.depth && `${product.depth}" D`, product.width && `${product.width}" W`, product.height && `${product.height}" H`].filter(Boolean).join(' x ')}
                    </p>
                  )}
                  {product.seat_height && <p>Seat Height : {product.seat_height}"</p>}
                  {(product.seat_width || product.seat_depth) && (
                    <p>Seat : {[product.seat_width && `${product.seat_width}" W`, product.seat_depth && `${product.seat_depth}" D`].filter(Boolean).join(' x ')}</p>
                  )}
                  {(product.arm_height || product.back_height) && (
                    <p>{[product.arm_height && `Arm Height : ${product.arm_height}"`, product.back_height && `Back Height : ${product.back_height}"`].filter(Boolean).join(' · ')}</p>
                  )}
                  {(product.shipping_weight != null || product.weight != null) && (
                    <p>Shipping Weight : {product.shipping_weight ?? product.weight} lbs</p>
                  )}
                  {product.upholstery_amount != null && product.upholstery_amount > 0 && (
                    <p>Upholstery : {Number(product.upholstery_amount) === parseInt(product.upholstery_amount, 10) ? product.upholstery_amount : Number(product.upholstery_amount).toFixed(1)} yd</p>
                  )}
                  {!product.width && !product.depth && !product.height && !product.seat_height && !product.seat_width && !product.seat_depth && !product.arm_height && !product.back_height && !product.weight && !product.shipping_weight && (product.upholstery_amount == null || product.upholstery_amount <= 0) && (
                    <p className="text-slate-500">—</p>
                  )}
                </div>
              </div>

              {/* Certifications */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-5">Certifications</h3>
                <div className="space-y-3.5 text-slate-700 text-[15px] leading-relaxed">
                  {product.flame_certifications && product.flame_certifications.length > 0 && (
                    <p>{product.flame_certifications.join(', ')}</p>
                  )}
                  {product.green_certifications && product.green_certifications.length > 0 && (
                    <p>{product.green_certifications.join(', ')}</p>
                  )}
                  {product.ada_compliant && <p>ADA Compliant</p>}
                  {(!product.flame_certifications || product.flame_certifications.length === 0) &&
                    (!product.green_certifications || product.green_certifications.length === 0) &&
                    !product.ada_compliant && (
                      <p className="text-slate-500">—</p>
                    )}
                </div>
                {(product.spec_sheet_url || product.dimensional_drawing_url || product.cad_file_url) && (
                  <div className="mt-5 pt-4 border-t border-cream-200">
                    <p className="text-slate-500 text-sm mb-2">Resources</p>
                    <div className="flex flex-col gap-2 text-[15px]">
                      {product.spec_sheet_url && (
                        <a href={resolveFileUrl(product.spec_sheet_url)} download className="text-slate-700 hover:text-slate-900 underline">
                          Spec Sheet
                        </a>
                      )}
                      {product.dimensional_drawing_url && (
                        <a href={resolveFileUrl(product.dimensional_drawing_url)} download className="text-slate-700 hover:text-slate-900 underline">
                          Dimensional Drawing
                        </a>
                      )}
                      {product.cad_file_url && (
                        <a href={resolveFileUrl(product.cad_file_url)} download className="text-slate-700 hover:text-slate-900 underline">
                          CAD File
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery - only gallery images (not primary/hover/thumbnail); 16:9; large left, strip right; auto-rotate 5s */}
      {galleryOnlyImages.length > 0 && (
        <section className="bg-white border-b border-cream-200">
          <div className="container mx-auto px-4 py-16 max-w-7xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8 text-center">Gallery</h2>
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-6xl mx-auto">
              <button
                type="button"
                onClick={() => openLightbox(galleryOnlyImages, gallerySelectedIndex)}
                className="flex-1 min-w-0 aspect-video overflow-hidden cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <img
                  src={galleryOnlyImages[gallerySelectedIndex]}
                  alt={`${product.name} gallery ${gallerySelectedIndex + 1}`}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />
              </button>
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-visible max-h-none lg:max-h-[360px] pb-2 lg:pb-0 flex-shrink-0 lg:w-48 xl:w-56">
                {galleryOnlyImages.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGallerySelectedIndex(idx)}
                    className={`flex-shrink-0 aspect-video overflow-hidden block w-32 sm:w-40 lg:w-full text-left focus:outline-none rounded ${idx === gallerySelectedIndex ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover block"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Customize & Quote Section */}
      <section ref={customizeRef} className="bg-cream-50 border-b border-cream-200 scroll-mt-20">
        <div className="container mx-auto px-4 py-12 sm:py-16 max-w-7xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 sm:mb-8">Customize & Request Quote</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* 3D Model Placeholder / Product Image (primary + hover only) */}
            <div className="flex items-center justify-center">
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => openLightbox(carouselImages, customizeImageIndex)}
                  className="bg-white rounded-xl overflow-hidden border border-cream-200 block w-full cursor-zoom-in hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  <img
                    src={carouselImages[customizeImageIndex] || carouselImages[0]}
                    alt={product.name}
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '500px', mixBlendMode: 'multiply' }}
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                  />

                  {/* 3D Coming Soon Badge */}
                  <div className="absolute bottom-12 left-4 right-4 bg-cream-50/90 backdrop-blur-sm border border-primary-500 rounded-lg p-3 text-center pointer-events-none">
                    <p className="text-primary-400 font-semibold text-sm">3D Customization Coming Soon</p>
                    <p className="text-slate-600 text-xs mt-1">Interactive 3D model viewer in development</p>
                  </div>
                </button>

                {carouselImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCustomizeImageIndex(customizeImageIndex === 0 ? carouselImages.length - 1 : customizeImageIndex - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomizeImageIndex(customizeImageIndex === carouselImages.length - 1 ? 0 : customizeImageIndex + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-cream-50/80 border border-cream-300 rounded-full text-sm text-slate-800">
                      {customizeImageIndex + 1} / {carouselImages.length}
                    </div>
                  </>
                )}

                <div className="flex items-center justify-center gap-6 text-sm mt-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadImage(carouselImages[customizeImageIndex] || carouselImages[0])}
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
                          <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${selectedVariation.stock_status === 'Available'
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
                            Price adjustment (est. listing): {selectedVariation.price_adjustment > 0 ? '+' : ''}
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
                    {product.customizations.finishes.map((finish, idx) => {
                      const f = typeof finish === 'object' ? finish : { name: finish };
                      const isSelected = typeof selectedFinish === 'object' ? selectedFinish?.id === f.id : selectedFinish === f.name;
                      return (
                        <button
                          key={f.id ?? idx}
                          onClick={() => setSelectedFinish(f)}
                          className={`p-2 sm:p-3 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px] flex items-center gap-2 ${isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-cream-300 bg-white text-slate-700 hover:border-primary-400'
                            }`}
                        >
                          <SwatchImage item={f} size="md" rounded="circle" zoom />
                          <span className="truncate">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upholstery/Fabrics */}
              {product.customizations?.fabrics && product.customizations.fabrics.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Upholstery
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {product.customizations.fabrics.map((fabric, idx) => {
                      const f = typeof fabric === 'object' ? fabric : { name: fabric };
                      const isSelected = typeof selectedUpholstery === 'object' ? selectedUpholstery?.id === f.id : selectedUpholstery === f.name;
                      return (
                        <button
                          key={f.id ?? idx}
                          onClick={() => setSelectedUpholstery(f)}
                          className={`p-2 sm:p-3 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px] flex items-center gap-2 ${isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-cream-300 bg-white text-slate-700 hover:border-primary-400'
                            }`}
                        >
                          <SwatchImage item={f} size="md" rounded="circle" zoom />
                          <span className="truncate">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colors (if different from finishes) */}
              {product.customizations?.colors && product.customizations.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Color
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {product.customizations.colors.map((color, idx) => {
                      const c = typeof color === 'object' ? color : { name: color };
                      const isSelected = typeof selectedFinish === 'object' ? selectedFinish?.id === c.id : selectedFinish === c.name;
                      return (
                        <button
                          key={c.id ?? idx}
                          onClick={() => setSelectedFinish(c)}
                          className={`p-2 sm:p-3 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px] flex items-center gap-2 ${isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900'
                            : 'border-cream-300 bg-white text-slate-700 hover:border-primary-400'
                            }`}
                        >
                          <SwatchImage item={c} size="md" rounded="circle" zoom />
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Requests / Notes */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setNotesExpanded(!notesExpanded)}
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-slate-700 py-2 px-3 rounded-lg hover:bg-cream-100 transition-colors"
                >
                  <span>Custom Requests / Notes</span>
                  <svg
                    className={`w-5 h-5 text-slate-500 transition-transform ${notesExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {notesExpanded && (
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Add custom requests, special instructions, or notes for this product..."
                    rows={4}
                    className="w-full mt-2 px-4 py-3 border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base resize-y min-h-[100px]"
                  />
                )}
              </div>

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
              <div>
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

      {/* More from this Family */}
      {familyProducts.length > 0 && (
        <section className="bg-cream-50 border-t border-cream-200">
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">More from this Family</h2>
              <div className="flex items-center gap-3">
                {product.family?.catalog_pdf_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(resolveFileUrl(product.family.catalog_pdf_url), '_blank', 'noopener,noreferrer')}
                  >
                    View Product Family Catalog
                  </Button>
                )}
                {product.family && (
                  <Link
                    to={`/families/${product.family.slug || product.family.id}`}
                    className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    View Collection <span aria-hidden="true">&rarr;</span>
                  </Link>
                )}
              </div>
            </div>
            <ProductCarousel>
              {familyProducts.map((familyProduct) => (
                <ProductCard
                  key={familyProduct.id}
                  product={familyProduct}
                  onQuickView={handleQuickView}
                />
              ))}
            </ProductCarousel>
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="bg-white border-t border-cream-200">
          <div className="container mx-auto px-4 py-12 max-w-7xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Recommended Products</h2>
              <Link
                  to={`/products/${product.id}/related`}
                  className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  See All <span aria-hidden="true">&rarr;</span>
                </Link>
            </div>
            <ProductCarousel>
              {relatedProducts.slice(0, 20).map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  onQuickView={handleQuickView}
                />
              ))}
            </ProductCarousel>
          </div>
        </section>
      )}

      <QuickViewModal
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
      />

      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
      />
    </div>
  );
};

export default ProductDetailPage;



