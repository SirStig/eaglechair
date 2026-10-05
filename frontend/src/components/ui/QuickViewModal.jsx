import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import Tag from './Tag';
import { useCartStore } from '../../store/cartStore';
import { getProductImages, buildProductUrl, resolveImageUrl, variationHasOwnImage, formatStockStatus, isInStock } from '../../utils/apiHelpers';
import OptionPicker from './OptionPicker';
import { optionsIfEnabled, sourcesFor } from '../../utils/productOptions';
import ResponsiveImage from './ResponsiveImage';
import VariationImageDisclaimer from './VariationImageDisclaimer';
import SpecSymbols, { SpecIcon } from './SpecSymbols';
import useSpecProfile from '../../hooks/useSpecProfile';
import { getSpecItems, getFeatureSymbol } from '../../utils/specSymbols';
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
  const [selectedLaminate, setSelectedLaminate] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [loadingVariations, setLoadingVariations] = useState(false);
  // Image URLs that failed to load (shown as the placeholder instead)
  const [failedImages, setFailedImages] = useState({});
  const specProfile = useSpecProfile(product);

  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setQuantity(1);
      setSelectedVariation(null);
      
      // Options start unselected; the customer picks only what they care about
      setSelectedFinish(null);
      setSelectedUpholstery(null);
      setSelectedColor(null);
      setSelectedLaminate(null);

      // Fetch variations
      if (product.id) {
        setLoadingVariations(true);
        logger.info(CONTEXT, `Fetching variations for product ID: ${product.id}`);
        productService.getProductVariations(product.id)
          .then((vars) => {
            logger.info(CONTEXT, `Loaded ${vars?.length || 0} variations`, vars);
            const loaded = vars || [];
            setVariations(loaded);
            if (product.variation_id && loaded.length > 0) {
              const match = loaded.find((v) => v.id === product.variation_id);
              if (match) setSelectedVariation(match);
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
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
      upholstery: optionsIfEnabled(product, selectedVariation, 'upholstery', selectedUpholstery) ?? null,
      color: optionsIfEnabled(product, selectedVariation, 'colors', selectedColor) ?? null,
      laminate: selectedLaminate && optionsIfEnabled(product, selectedVariation, 'laminates', true) ? { id: selectedLaminate.id, name: selectedLaminate.name, brand: selectedLaminate.brand } : null,
      variation: selectedVariation,
    };
    addItem(product, quantity, customizations);
    logger.info(CONTEXT, `Added to cart: ${product.name} x${quantity}${selectedVariation ? ` (variation: ${selectedVariation.sku})` : ''}`);
    onClose();
  };

  if (!product) return null;

  const getDisplayImages = () => {
    if (selectedVariation && selectedVariation.images) {
      let imagesArray = selectedVariation.images;
      if (typeof imagesArray === 'string') {
        try {
          imagesArray = JSON.parse(imagesArray);
        } catch {
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
  const isShowingBaseImageForVariation = selectedVariation
    ? !variationHasOwnImage(selectedVariation)
    : Boolean(product.variation_id && !product.variation_has_own_image);
  const productUrl = buildProductUrl(product);

  const modelLabel = [product.model_number, product.model_suffix].filter(Boolean).join(' ');
  const variationDetails = selectedVariation
    ? [selectedVariation.finish?.name, selectedVariation.upholstery?.name, selectedVariation.color?.name].filter(Boolean)
    : [];
  const specItems = getSpecItems(product, selectedVariation, specProfile);
  const features = (product.features || []).slice(0, 4);
  const currentImage = failedImages[images[selectedImage]] ? '/placeholder.svg' : images[selectedImage];
  const stepImage = (delta) => setSelectedImage((i) => (i + delta + images.length) % images.length);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 animate-fadeIn" role="dialog" aria-modal="true" aria-label={product.name}>
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel: never taller than the window; details scroll inside it */}
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-cream-300 bg-white shadow-2xl animate-scaleIn sm:max-h-[min(90dvh,760px)] sm:max-w-5xl sm:rounded-2xl md:flex-row">
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-cream-300 bg-white/90 shadow-sm transition-colors hover:bg-cream-100"
        >
          <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image: a fixed box the picture fills, so it never sizes itself
            from the tiny blurred placeholder while loading */}
        <div className="relative h-[34dvh] shrink-0 bg-cream-50 sm:h-[40dvh] md:h-auto md:w-[45%]">
          <div className="absolute inset-0 overflow-hidden">
            {isShowingBaseImageForVariation && <VariationImageDisclaimer compact />}
            <ResponsiveImage
              key={currentImage}
              src={currentImage}
              sizes="(min-width: 768px) 460px, 100vw"
              priority
              alt={product.name}
              className="absolute inset-0 h-full w-full object-contain p-4 sm:p-6"
              style={{ mixBlendMode: 'multiply' }}
              onError={() => setFailedImages((prev) => ({ ...prev, [images[selectedImage]]: true }))}
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={() => stepImage(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-cream-300 bg-white/85 transition-colors hover:bg-white"
              >
                <svg className="h-4 w-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => stepImage(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-cream-300 bg-white/85 transition-colors hover:bg-white"
              >
                <svg className="h-4 w-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setSelectedImage(i)}
                    aria-label={`Image ${i + 1} of ${images.length}`}
                    className={`h-1.5 rounded-full transition-all ${i === selectedImage ? 'w-5 bg-slate-700' : 'w-1.5 bg-slate-400/60'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Details */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5 sm:px-6">
            <div className="pr-10">
              {(product.isNew || product.featured || product.is_outdoor_suitable || product.tags?.length > 0) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {product.isNew && <Tag variant="new" size="sm">New</Tag>}
                  {product.featured && <Tag variant="featured" size="sm">Featured</Tag>}
                  {product.is_outdoor_suitable && <Tag variant="default" size="sm">Outdoor</Tag>}
                  {product.tags?.map((tag) => (
                    <Tag key={tag} variant="commercial" size="sm">{tag}</Tag>
                  ))}
                </div>
              )}
              <h2 className="text-xl font-bold leading-tight text-slate-800 sm:text-2xl">{product.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedVariation?.sku ? `SKU ${selectedVariation.sku}` : modelLabel && `Model ${modelLabel}`}
              </p>
            </div>

            {(product.short_description || product.description) && (
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-700">
                {product.short_description || product.description}
              </p>
            )}

            {/* Specs */}
            {(specItems.length > 0 || features.length > 0) && (
              <div className="mt-4 grid gap-4 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs sm:grid-cols-2">
                {specItems.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 font-semibold text-slate-800">Dimensions</h4>
                    <SpecSymbols items={specItems} size="sm" />
                  </div>
                )}
                {features.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 font-semibold text-slate-800">Features</h4>
                    <ul className="space-y-1 text-slate-600">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start">
                          {getFeatureSymbol(feature) ? (
                            <SpecIcon name={getFeatureSymbol(feature)} className="mr-1 h-4 w-4 flex-shrink-0" />
                          ) : (
                            <span className="mr-1 text-primary-500">•</span>
                          )}
                          <span className="line-clamp-1">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Variation */}
            {variations.length > 0 && (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="quickview-variation">
                  Variation {loadingVariations && <span className="text-xs text-slate-400">(loading…)</span>}
                </label>
                <select
                  id="quickview-variation"
                  value={selectedVariation === null ? 'base' : (selectedVariation?.id ?? '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVariation(val === 'base' || val === '' ? null : variations.find((v) => v.id === parseInt(val, 10)) || null);
                    setSelectedImage(0);
                  }}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={loadingVariations}
                >
                  <option value="base">{modelLabel ? `${modelLabel} — Base model` : 'Base model'}</option>
                  {variations.map((variation) => {
                    const details = [variation.finish?.name, variation.upholstery?.name, variation.color?.name].filter(Boolean);
                    const label = [variation.sku, details.length ? `(${details.join(' / ')})` : ''].filter(Boolean).join(' ');
                    return (
                      <option key={variation.id} value={variation.id}>
                        {label || `Variation #${variation.id}`}
                      </option>
                    );
                  })}
                </select>
                {selectedVariation && (variationDetails.length > 0 || selectedVariation.stock_status || selectedVariation.lead_time_days) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {variationDetails.map((d) => (
                      <span key={d} className="rounded-md border border-cream-300 bg-cream-50 px-2 py-0.5 text-slate-700">{d}</span>
                    ))}
                    {selectedVariation.stock_status && (
                      <span className={`rounded-md px-2 py-0.5 ${isInStock(selectedVariation) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {formatStockStatus(selectedVariation.stock_status)}
                      </span>
                    )}
                    {selectedVariation.lead_time_days && (
                      <span className="text-slate-600">Lead time {selectedVariation.lead_time_days} days</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Options */}
            <OptionPicker
              compact
              className="mt-4"
              productId={product.id}
              sections={[
                { key: 'finish', label: 'Finish', kind: 'wood', options: product.customizations?.finishes, sources: sourcesFor(product, selectedVariation, 'finish'), selected: selectedFinish, onSelect: setSelectedFinish },
                { key: 'upholstery', label: 'Upholstery', kind: 'fabric', options: optionsIfEnabled(product, selectedVariation, 'upholstery', product.customizations?.fabrics), sources: sourcesFor(product, selectedVariation, 'upholstery'), selected: selectedUpholstery, onSelect: setSelectedUpholstery },
                { key: 'laminate', label: 'Laminate', kind: 'laminate', options: optionsIfEnabled(product, selectedVariation, 'laminates', product.customizations?.laminates), sources: sourcesFor(product, selectedVariation, 'laminate'), selected: selectedLaminate, onSelect: setSelectedLaminate },
                { key: 'color', label: 'Color', options: optionsIfEnabled(product, selectedVariation, 'colors', product.customizations?.colors), selected: selectedColor, onSelect: setSelectedColor },
              ]}
            />
          </div>

          {/* Footer: always visible */}
          <div className="shrink-0 border-t border-cream-200 bg-white px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 items-center rounded-lg border border-cream-300" role="group" aria-label="Quantity">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-11 w-9 items-center justify-center font-bold text-slate-800 hover:bg-cream-100"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  aria-label="Quantity"
                  className="h-11 w-12 border-x border-cream-300 bg-white text-center text-sm text-slate-800 focus:outline-none"
                  min="1"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Increase quantity"
                  className="flex h-11 w-9 items-center justify-center font-bold text-slate-800 hover:bg-cream-100"
                >
                  +
                </button>
              </div>
              <Button variant="primary" className="h-11 flex-1 px-4 text-sm sm:text-base" onClick={handleAddToCart}>
                <svg className="mr-2 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Add {quantity} to Cart
              </Button>
            </div>
            <Link
              to={productUrl}
              onClick={onClose}
              className="mt-2 block text-center text-sm font-medium text-primary-600 hover:text-primary-500 hover:underline"
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;

