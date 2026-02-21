import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';
import Button from './Button';
import { formatPrice, getProductHoverImages, buildProductUrl, hasValidPrice } from '../../utils/apiHelpers';
import SwatchImage from './SwatchImage';

const ProductCard = ({ product, onQuickView, darkMode = false, compact = false }) => {
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

  // Handle carousel rotation
  useEffect(() => {
    let interval;

    if (isHovered && hasCarousel) {
      // Start cycling through images
      interval = setInterval(() => {
        setActiveImageIndex(prev => (prev + 1) % carouselImages.length);
      }, 1200); // 1.2s interval
    } else {
      // Reset to primary image when not hovered
      setActiveImageIndex(0);
    }

    return () => clearInterval(interval);
  }, [isHovered, hasCarousel, carouselImages.length]);

  // Determine which image to display
  const displayImage = carouselImages[activeImageIndex];

  const hasPrice = hasValidPrice(product);
  const hasPriceRange = product.priceRange?.min != null && product.priceRange?.max != null && product.priceRange.min !== product.priceRange.max;
  const priceRangeValid = hasPriceRange && product.priceRange.min > 0 && product.priceRange.max > 0;
  const priceDisplay = priceRangeValid
    ? `$${product.priceRange.min.toFixed(2)} - $${product.priceRange.max.toFixed(2)}`
    : hasPrice ? formatPrice(product.base_price) : 'No List Price';

  const finishes = product.customizations?.finishes?.slice(0, 5) || [];
  const colors = product.customizations?.colors?.slice(0, 5) || [];
  const swatches = finishes.length > 0 ? finishes : colors;

  // Dark mode color classes
  const bgImage = darkMode ? 'bg-dark-800' : 'bg-cream-100';
  const textCategory = darkMode ? 'text-dark-300' : 'text-slate-500';
  const textType = darkMode ? 'text-dark-200' : 'text-slate-600';
  const textSeparator = darkMode ? 'text-dark-500' : 'text-slate-300';
  const textTitle = darkMode ? 'text-dark-50' : 'text-slate-800';
  const textTitleHover = darkMode ? 'hover:text-primary-400' : 'hover:text-primary-600';
  const textDescription = darkMode ? 'text-dark-200' : 'text-slate-600';
  const textSwatchLabel = darkMode ? 'text-dark-300' : 'text-slate-500';
  const borderSwatch = darkMode ? 'border-dark-500' : 'border-slate-300';
  const borderSwatchDashed = darkMode ? 'border-dark-500' : 'border-slate-300';
  const textSwatchMore = darkMode ? 'text-dark-400' : 'text-slate-500';
  const textPrice = darkMode ? 'text-dark-50' : 'text-slate-900';
  const textPriceNote = darkMode ? 'text-dark-300' : 'text-slate-500';
  const spinnerBorder = darkMode ? 'border-dark-600' : 'border-cream-300';

  const productUrl = buildProductUrl(product, product.variation_id);

  return (
    <div
      className="group flex flex-col h-full bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={productUrl} className={`block relative overflow-hidden ${bgImage} flex-shrink-0 rounded-lg ${compact ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}>
        {/* Show placeholder immediately while loading */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-700/20">
            <div className={`h-8 w-8 border-4 ${spinnerBorder} border-t-primary-500 rounded-full animate-spin`} />
          </div>
        )}
        {/* Show placeholder image on error */}
        {imageError && (
          <img
            src="/placeholder-product.jpg"
            alt={product.name}
            className="w-full h-full object-contain opacity-100"
            style={{ mixBlendMode: 'multiply' }}
          />
        )}
        {/* Main product image */}
        {!imageError && (
          <div className="w-full h-full relative">
            {/* We use a key based on the image URL to force re-render/fade if needed, 
                but for smooth transition we might want to keep the same img tag and just change src 
                OR use multiple images and fade between them. 
                For now, simple src swap with transition class on parent or img. */}
            <img
              key={displayImage} // Force transition when image changes
              src={displayImage || '/placeholder-product.jpg'}
              alt={product.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`w-full h-full object-contain transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${isHovered && !hasCarousel ? 'group-hover:scale-105' : ''}`}
              style={{ mixBlendMode: 'multiply' }}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />

            {/* Carousel Indicators (optional, keeping minimal for now as requested) */}
            {hasCarousel && isHovered && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                {carouselImages.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${idx === activeImageIndex ? 'bg-primary-600' : 'bg-slate-300/60'
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Overlay on hover */}
        <div
          className={`absolute inset-0 bg-black/30 flex items-center justify-center gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.(product);
            }}
          >
            Quick View
          </Button>
        </div>

        {/* Tags */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {product.is_new && <Tag variant="new" size="sm">New</Tag>}
          {product.is_featured && <Tag variant="featured" size="sm">Featured</Tag>}
        </div>
      </Link>

      {/* Product Info - Below Image */}
      <div className="pt-3 sm:pt-4 flex flex-col flex-grow">
        {/* Category & Type */}
        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
          {product.category && (
            <span className={`text-[10px] sm:text-xs ${textCategory} uppercase tracking-wider font-medium truncate`}>
              {product.category}
            </span>
          )}
          {product.product_type && (
            <>
              <span className={`${textSeparator} hidden sm:inline`}>•</span>
              <span className={`text-[10px] sm:text-xs ${textType} font-medium truncate`}>
                {product.product_type}
              </span>
            </>
          )}
        </div>

        {/* Product Name */}
        <Link to={productUrl}>
          <h3 className={`text-base sm:text-lg font-semibold ${textTitle} mb-1.5 sm:mb-2 ${textTitleHover} transition-colors line-clamp-2`}>
            {product.name}
          </h3>
        </Link>

        {/* Description */}
        {(product.short_description || product.description) && (
          <p className={`text-xs sm:text-sm ${textDescription} mb-2 sm:mb-3 line-clamp-2 leading-relaxed`}>
            {product.short_description || product.description}
          </p>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
            {product.tags.slice(0, 3).map((tag, idx) => (
              <Tag key={idx} variant="commercial" size="sm">
                {tag}
              </Tag>
            ))}
          </div>
        )}

        {/* Swatches - Show available options */}
        {swatches.length > 0 && (
          <div className="mb-2 sm:mb-3">
            <p className={`text-[10px] sm:text-xs ${textSwatchLabel} mb-1.5 sm:mb-2`}>Available in {swatches.length}+ options:</p>
            <div className="flex gap-1 sm:gap-1.5 items-center">
              {swatches.map((swatch, idx) => {
                const item = typeof swatch === 'object' ? swatch : { name: swatch };
                return (
                  <SwatchImage
                    key={item.id ?? idx}
                    item={item}
                    size="xs"
                    rounded="circle"
                    zoom
                  />
                );
              })}
              {(product.customizations?.finishes?.length > 5 || product.customizations?.colors?.length > 5) && (
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-dashed ${borderSwatchDashed} flex items-center justify-center text-[9px] sm:text-[10px] ${textSwatchMore}`}>
                  +
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="mb-3 sm:mb-4">
          <span className={`text-lg sm:text-xl font-bold ${textPrice}`}>{priceDisplay}</span>
          <span className={`text-[10px] sm:text-xs ${textPriceNote} ml-1`}>
            {priceDisplay !== 'No List Price' ? (
              <>
                {priceRangeValid ? 'per unit · ' : ''}
                Est. listing
              </>
            ) : (
              '· Contact for quote'
            )}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2">
          <Link to={productUrl} className="flex-1">
            <Button
              variant="primary"
              size="sm"
              className="w-full text-xs px-2 py-1.5 min-h-[36px] sm:text-sm sm:px-4 sm:py-2 sm:min-h-[40px]"
            >
              View Details
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.(product);
            }}
            className="flex-shrink-0 px-2 py-1.5 min-h-[36px] sm:px-3 sm:py-2 sm:min-h-[40px]"
          >
            <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;


