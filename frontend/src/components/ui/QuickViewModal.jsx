import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import Tag from './Tag';
import { useCartStore } from '../../store/cartStore';
import { getProductImages, buildProductUrl, resolveImageUrl } from '../../utils/apiHelpers';
import SwatchImage from './SwatchImage';
import productService from '../../services/productService';
import logger from '../../utils/logger';

const CONTEXT = 'QuickViewModal';

const QuickViewModal = ({ product, isOpen, onClose }) => {
  const { addItem } = useCartStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(null);
  const [selectedUpholstery, setSelectedUpholstery] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [loadingVariations, setLoadingVariations] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setQuantity(1);
      setSelectedVariation(null);
      
      // Initialize selections
      if (product.customizations?.finishes?.[0]) {
        setSelectedFinish(product.customizations.finishes[0]);
      }
      if (product.customizations?.fabrics?.[0]) {
        setSelectedUpholstery(product.customizations.fabrics[0]);
      }
      if (product.customizations?.colors?.[0]) {
        setSelectedColor(product.customizations.colors[0]);
      }

      // Fetch variations
      if (product.id) {
        setLoadingVariations(true);
        logger.info(CONTEXT, `Fetching variations for product ID: ${product.id}`);
        productService.getProductVariations(product.id)
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
    }
  }, [product]);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleAddToCart = () => {
    const customizations = {
      finish: selectedFinish,
      upholstery: selectedUpholstery,
      color: selectedColor,
      variation: selectedVariation,
    };
    addItem(product, quantity, customizations);
    logger.info(CONTEXT, `Added to cart: ${product.name} x${quantity}${selectedVariation ? ` (variation: ${selectedVariation.sku})` : ''}`);
    onClose();
  };

  if (!product) return null;

  // Get images - use variation images if variation is selected, otherwise product images
  const getDisplayImages = () => {
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
  };

  const images = getDisplayImages();
  const productUrl = buildProductUrl(product);

  // Calculate price - use variation price if selected
  const getDisplayPrice = () => {
    const basePrice = product.base_price || product.priceRange?.min || 0;
    if (selectedVariation && selectedVariation.price_adjustment !== undefined) {
      const variationPrice = (basePrice + (selectedVariation.price_adjustment || 0)) / 100;
      return `$${variationPrice.toFixed(2)}`;
    }
    if (product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max) {
      return `$${product.priceRange.min.toFixed(2)} - $${product.priceRange.max.toFixed(2)}`;
    }
    return `$${(basePrice / 100).toFixed(2)}`;
  };

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 overflow-y-auto animate-fadeIn">
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl border border-cream-300 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white hover:bg-cream-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Content */}
                <div className="grid md:grid-cols-2 gap-8 p-8" style={{ minHeight: '600px' }}>
                  {/* Left: Image Gallery */}
                  <div className="flex items-center justify-center h-full">
                    <div className="relative inline-block w-full h-full flex items-center justify-center">
                      {/* Main Image */}
                      <div className="bg-cream-50 rounded-lg overflow-hidden border border-cream-300 flex items-center justify-center h-full">
                        <img
                          src={images[selectedImage]}
                          alt={product.name}
                          className="w-full h-auto object-contain"
                          style={{ maxHeight: '70vh', mixBlendMode: 'multiply' }}
                        />
                      </div>

                      {/* Gallery Navigation */}
                      {images.length > 1 && (
                        <>
                          {/* Previous Button */}
                          <button
                            onClick={() => setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                          >
                            <svg className="w-5 h-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>

                          {/* Next Button */}
                          <button
                            onClick={() => setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-cream-50/80 hover:bg-cream-50 border border-cream-300 rounded-full transition-colors"
                          >
                            <svg className="w-5 h-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          {/* Image Counter */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-cream-50/80 border border-cream-300 rounded-full text-xs text-slate-800">
                            {selectedImage + 1} / {images.length}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Details */}
                  <div className="flex flex-col">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {product.isNew && <Tag variant="new" size="sm">New</Tag>}
                      {product.featured && <Tag variant="featured" size="sm">Featured</Tag>}
                      {product.is_outdoor_suitable && <Tag variant="default" size="sm">Outdoor</Tag>}
                      {product.tags?.map((tag) => (
                        <Tag key={tag} variant="commercial" size="sm">{tag}</Tag>
                      ))}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{product.name}</h2>

                    {/* Model Number */}
                    {product.model_number && (
                      <p className="text-sm text-slate-600 mb-2">Model: {product.model_number}</p>
                    )}

                    {/* Price */}
                    {(product.price || product.priceRange || selectedVariation) && (
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-slate-900">
                          {getDisplayPrice()}
                        </span>
                        <span className="text-sm text-slate-500 ml-2">
                          {(selectedVariation || (product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max)) ? 'per unit · ' : ''}
                          Est. listing
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-slate-700 mb-6 leading-relaxed line-clamp-3 text-sm">
                      {product.short_description || product.description}
                    </p>

                    {/* Quick Specs - 3 Columns */}
                    <div className="bg-cream-50 rounded-lg p-4 mb-6 border border-cream-200">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {/* Dimensions */}
                        <div>
                          <h4 className="font-semibold text-slate-800 mb-2">Dimensions</h4>
                          <div className="space-y-1 text-slate-600">
                            {product.width && <p>W: {product.width}"</p>}
                            {product.depth && <p>D: {product.depth}"</p>}
                            {product.height && <p>H: {product.height}"</p>}
                          </div>
                        </div>

                        {/* Features */}
                        {product.features && product.features.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Features</h4>
                            <ul className="space-y-1 text-slate-600">
                              {product.features.slice(0, 3).map((feature, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-primary-500 mr-1">•</span>
                                  <span className="line-clamp-1">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Variations */}
                        {(product.customizations?.finishes || product.customizations?.colors) && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Options</h4>
                            <div className="space-y-1 text-slate-600">
                              {product.customizations.finishes && (
                                <p>{product.customizations.finishes.length} Finishes</p>
                              )}
                              {product.customizations.colors && (
                                <p>{product.customizations.colors.length} Colors</p>
                              )}
                              {product.customizations.fabrics && (
                                <p>{product.customizations.fabrics.length} Fabrics</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Variations Selection */}
                    {variations.length > 0 && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Product Variations {loadingVariations && <span className="text-xs text-slate-400">(Loading...)</span>}
                        </label>
                        <select
                          value={selectedVariation?.id || ''}
                          onChange={(e) => {
                            const variation = variations.find(v => v.id === parseInt(e.target.value));
                            setSelectedVariation(variation || null);
                            setSelectedImage(0); // Reset image when variation changes
                          }}
                          className="w-full px-3 py-2 text-sm border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          disabled={loadingVariations}
                        >
                          <option value="">Select a variation...</option>
                          {variations.map((variation) => {
                            // Build variation display name
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
                          <div className="mt-3 space-y-2">
                            {/* Variation Details */}
                            <div className="text-sm text-slate-700 space-y-1">
                              {selectedVariation.sku && (
                                <div>
                                  <span className="font-medium">SKU:</span> {selectedVariation.sku}
                                </div>
                              )}
                              {(selectedVariation.finish || selectedVariation.upholstery || selectedVariation.color) && (
                                <div>
                                  <span className="font-medium">Specifications:</span>
                                  <ul className="list-disc list-inside ml-2 mt-1">
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
                            {/* Stock Status */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {selectedVariation.stock_status && (
                                <span className={`inline-block px-2 py-1 rounded text-xs ${
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
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customization Options */}
                    <div className="space-y-3 mb-6">
                      {/* Finishes */}
                      {product.customizations?.finishes && product.customizations.finishes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Finish
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {product.customizations.finishes.map((finish, idx) => {
                              const f = typeof finish === 'object' ? finish : { name: finish };
                              const isSelected = typeof selectedFinish === 'object' ? selectedFinish?.id === f.id : selectedFinish === f.name;
                              return (
                                <button
                                  key={f.id ?? idx}
                                  type="button"
                                  onClick={() => setSelectedFinish(f)}
                                  className={`p-1.5 rounded-lg border-2 transition-all flex items-center gap-1.5 ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-cream-300 bg-white hover:border-primary-400'}`}
                                  title={f.name}
                                >
                                  <SwatchImage item={f} size="sm" rounded="circle" zoom />
                                  <span className="text-xs truncate max-w-[60px]">{f.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fabrics */}
                      {product.customizations?.fabrics && product.customizations.fabrics.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Upholstery
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {product.customizations.fabrics.map((fabric, idx) => {
                              const f = typeof fabric === 'object' ? fabric : { name: fabric };
                              const isSelected = typeof selectedUpholstery === 'object' ? selectedUpholstery?.id === f.id : selectedUpholstery === f.name;
                              return (
                                <button
                                  key={f.id ?? idx}
                                  type="button"
                                  onClick={() => setSelectedUpholstery(f)}
                                  className={`p-1.5 rounded-lg border-2 transition-all flex items-center gap-1.5 ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-cream-300 bg-white hover:border-primary-400'}`}
                                  title={f.name}
                                >
                                  <SwatchImage item={f} size="sm" rounded="circle" zoom />
                                  <span className="text-xs truncate max-w-[60px]">{f.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Colors */}
                      {product.customizations?.colors && product.customizations.colors.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Color
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {product.customizations.colors.map((color, idx) => {
                              const c = typeof color === 'object' ? color : { name: color };
                              const isSelected = typeof selectedColor === 'object' ? selectedColor?.id === c.id : selectedColor === c.name;
                              return (
                                <button
                                  key={c.id ?? idx}
                                  type="button"
                                  onClick={() => setSelectedColor(c)}
                                  className={`p-1.5 rounded-lg border-2 transition-all flex items-center gap-1.5 ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-cream-300 bg-white hover:border-primary-400'}`}
                                  title={c.name}
                                >
                                  <SwatchImage item={c} size="sm" rounded="circle" zoom />
                                  <span className="text-xs truncate max-w-[60px]">{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Quantity
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-cream-300 rounded-lg hover:bg-cream-100 transition-colors text-slate-800 font-bold"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 h-9 text-center text-sm border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            min="1"
                          />
                          <button
                            onClick={() => setQuantity(quantity + 1)}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-cream-300 rounded-lg hover:bg-cream-100 transition-colors text-slate-800 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-col gap-3">
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
                      <Link to={productUrl} onClick={onClose} className="block">
                        <Button
                          variant="outline"
                          className="w-full text-base py-3 px-6"
                        >
                          View Full Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default QuickViewModal;

