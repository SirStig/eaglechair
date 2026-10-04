import { useState, useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';
import VariationImageDisclaimer from './VariationImageDisclaimer';
import { ArrowRight, Eye } from 'lucide-react';
import { getProductHoverImages, buildProductUrl } from '../../utils/apiHelpers';
import SwatchImage from './SwatchImage';
import ResponsiveImage from './ResponsiveImage';
import { markMainLoading, markMainSettled, whenMainImagesIdle } from '../../utils/hoverImagePreload';

// Catalog grid: 2 cols (<lg), 2 cols beside a ~320px sidebar (lg), 3 cols beside ~360px (xl)
const DEFAULT_IMAGE_SIZES = '(min-width: 1280px) 25vw, (min-width: 1024px) 36vw, 50vw';

// `priority`: load the image right away at high priority (first visible row)
const ProductCard = ({ product, onQuickView, darkMode = false, compact = false, imageSizes = DEFAULT_IMAGE_SIZES, priority = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop
    setImageError(true);
    setImageLoaded(true); // Show the placeholder
  };

  // Get all images for carousel (Primary + Hover images)
  // Logic: Primary -> Hover 1 -> Hover 2 -> Primary ...
  const carouselImages = getProductHoverImages(product);
  const hasCarousel = carouselImages.length > 1;

  // Angle images are stacked over the main image and toggled by visibility,
  // so cycling is an instant swap rather than a fresh progressive load.
  const cardId = useId();
  const imageBoxRef = useRef(null);
  const [mountAngles, setMountAngles] = useState(false);
  const [loadedAngles, setLoadedAngles] = useState(() => new Set());

  // While this card's main image is near the viewport and still loading,
  // hold back everyone's angle images.
  useEffect(() => {
    const el = imageBoxRef.current;
    if (imageLoaded || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) markMainLoading(cardId);
      else markMainSettled(cardId);
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => {
      observer.disconnect();
      markMainSettled(cardId);
    };
  }, [imageLoaded, cardId]);

  // Then load the angles in the background so they're ready before a hover
  useEffect(() => {
    if (!hasCarousel || !imageLoaded || imageError || mountAngles) return undefined;
    return whenMainImagesIdle(() => setMountAngles(true));
  }, [hasCarousel, imageLoaded, imageError, mountAngles]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (hasCarousel) setMountAngles(true);
  };

  // Handle carousel rotation
  useEffect(() => {
    let interval;
    let intent;

    if (isHovered && hasCarousel) {
      // Short hover-intent delay so sweeping the cursor across the grid
      // doesn't flip every card it passes; then cycle at a viewable pace.
      intent = setTimeout(() => {
        setActiveImageIndex(1);
        interval = setInterval(() => {
          setActiveImageIndex(prev => (prev + 1) % carouselImages.length);
        }, 1200);
      }, 200);
    } else {
      // Reset to primary image when not hovered
      setActiveImageIndex(0);
    }

    return () => {
      clearTimeout(intent);
      clearInterval(interval);
    };
  }, [isHovered, hasCarousel, carouselImages.length]);

  // An angle that hasn't loaded yet leaves the main image showing
  const activeAngle = isHovered && activeImageIndex > 0 ? carouselImages[activeImageIndex] : null;
  const showingAngle = Boolean(activeAngle && loadedAngles.has(activeAngle));

  const allFinishes = product.customizations?.finishes || [];
  const allColors = product.customizations?.colors || [];
  const swatchSource = allFinishes.length > 0 ? allFinishes : allColors;
  const swatches = swatchSource.slice(0, 5);
  const moreSwatches = swatchSource.length - swatches.length;

  // Dark mode color classes
  const bgImage = darkMode ? 'bg-dark-800' : 'bg-cream-100';
  const ringHover = darkMode ? 'group-hover:ring-dark-500' : 'group-hover:ring-cream-300';
  const textEyebrow = darkMode ? 'text-dark-300' : 'text-slate-500';
  const textTitle = darkMode ? 'text-dark-50' : 'text-slate-900';
  const textTitleHover = darkMode ? 'group-hover:text-primary-400' : 'group-hover:text-primary-700';
  const textMuted = darkMode ? 'text-dark-300' : 'text-slate-500';
  const textDescription = darkMode ? 'text-dark-200' : 'text-slate-600';
  const borderFooter = darkMode ? 'border-dark-600' : 'border-cream-200';
  const textLink = darkMode ? 'text-primary-400 hover:text-primary-300' : 'text-primary-700 hover:text-primary-800';
  const spinnerBorder = darkMode ? 'border-dark-600' : 'border-cream-300';

  const productUrl = buildProductUrl(product, product.variation_id);
  const eyebrow = [product.category, product.product_type].filter(Boolean).join(' · ');
  const description = product.short_description || product.description;

  const openQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  return (
    <div
      className="group flex flex-col h-full bg-transparent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={productUrl}
        className={`block relative overflow-hidden ${bgImage} flex-shrink-0 rounded-lg ring-1 ring-transparent ${ringHover} transition-shadow duration-200 group-hover:shadow-md ${compact ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}
      >
        {/* Show placeholder immediately while loading */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-700/20">
            <div className={`h-8 w-8 border-4 ${spinnerBorder} border-t-primary-500 rounded-full animate-spin`} />
          </div>
        )}
        {/* Show placeholder image on error */}
        {imageError && (
          <img
            src="/placeholder.svg"
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain opacity-100"
            style={{ mixBlendMode: 'multiply' }}
          />
        )}
        {/* Main product image */}
        {!imageError && (
          <div ref={imageBoxRef} className="w-full h-full relative">
            {product.variation_id && !product.variation_has_own_image && <VariationImageDisclaimer compact />}
            <ResponsiveImage
              src={carouselImages[0] || '/placeholder.svg'}
              sizes={imageSizes}
              alt={product.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`w-full h-full object-contain transition-transform duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${showingAngle ? 'invisible' : ''} ${isHovered && !hasCarousel ? 'group-hover:scale-[1.03]' : ''}`}
              style={{ mixBlendMode: 'multiply' }}
              priority={priority}
              fetchpriority={priority ? 'high' : 'low'}
            />

            {mountAngles && carouselImages.slice(1).map((url) => (
              <ResponsiveImage
                key={url}
                src={url}
                sizes={imageSizes}
                alt=""
                aria-hidden="true"
                placeholder={false}
                loading="eager"
                fetchpriority="low"
                onLoad={() => setLoadedAngles((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))}
                className={`absolute inset-0 w-full h-full object-contain ${url === activeAngle && showingAngle ? '' : 'invisible'}`}
                style={{ mixBlendMode: 'multiply' }}
              />
            ))}

            {/* Angle indicators */}
            {hasCarousel && (
              <div
                className={`absolute bottom-2.5 left-0 right-0 flex justify-center gap-1 z-10 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden="true"
              >
                {carouselImages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-200 ${idx === activeImageIndex ? 'w-4 bg-slate-700' : 'w-1.5 bg-slate-400/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick view: a small corner action so the product stays fully visible */}
        {onQuickView && (
          <button
            type="button"
            onClick={openQuickView}
            aria-label={`Quick view ${product.name}`}
            className={`absolute top-2 right-2 z-20 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/95 text-slate-800 text-xs font-semibold shadow-sm ring-1 ring-black/5 backdrop-blur-sm hover:bg-white hover:text-primary-700 transition-all duration-200 focus-visible:opacity-100 focus-visible:translate-y-0 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Quick view
          </button>
        )}

        {/* Tags */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
          {product.is_new && <Tag variant="new" size="sm">New</Tag>}
          {product.is_featured && <Tag variant="featured" size="sm">Featured</Tag>}
        </div>
      </Link>

      {/* Product info */}
      <div className="pt-3 sm:pt-4 flex flex-col flex-grow">
        {eyebrow && (
          <p className={`text-[10px] sm:text-[11px] ${textEyebrow} uppercase tracking-[0.12em] font-medium truncate mb-1`}>
            {eyebrow}
          </p>
        )}

        <Link to={productUrl} className="block">
          <h3 className={`text-[15px] sm:text-base font-semibold leading-snug ${textTitle} ${textTitleHover} transition-colors line-clamp-2`}>
            {product.name}
          </h3>
        </Link>

        {product.model_number && !String(product.name || '').includes(product.model_number) && (
          <p className={`mt-0.5 text-xs ${textMuted} tabular-nums`}>Model {product.model_number}</p>
        )}

        {description && (
          <p className={`mt-1.5 text-xs sm:text-sm ${textDescription} line-clamp-2 leading-relaxed`}>
            {description}
          </p>
        )}

        {swatches.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {swatches.map((swatch, idx) => {
              const item = typeof swatch === 'object' ? swatch : { name: swatch };
              return (
                <SwatchImage
                  key={item.id ?? idx}
                  item={item}
                  size="xs"
                  rounded="circle"
                  zoom
                  kind={allFinishes.length > 0 ? 'wood' : 'neutral'}
                />
              );
            })}
            {moreSwatches > 0 && (
              <span className={`text-[11px] ${textMuted} font-medium ml-0.5`}>+{moreSwatches}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`mt-auto pt-3 sm:pt-4`}>
          <div className={`flex items-center justify-between gap-2 pt-3 border-t ${borderFooter}`}>
            <Link
              to={productUrl}
              className={`inline-flex items-center gap-1 text-xs sm:text-sm font-semibold ${textLink} transition-colors`}
            >
              View details
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {onQuickView && (
              <button
                type="button"
                onClick={openQuickView}
                aria-label={`Quick view ${product.name}`}
                title="Quick view"
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${textMuted} hover:text-primary-700 hover:bg-cream-100 transition-colors`}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
