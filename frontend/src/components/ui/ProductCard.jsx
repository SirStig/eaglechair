import { useState } from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';
import Button from './Button';

const ProductCard = ({ product, onQuickView, darkMode = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Use angled view by default, switch to front view on hover
  const displayImage = isHovered && product.imageFront 
    ? product.imageFront 
    : product.imageAngle || product.image;

  // Format price display
  const formatPrice = (price) => {
    if (!price) return null;
    return `$${price.toFixed(2)}`;
  };

  const priceDisplay = product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max
    ? `${formatPrice(product.priceRange.min)} - ${formatPrice(product.priceRange.max)}`
    : formatPrice(product.price || product.priceRange?.min);

  // Get swatches - show first 4 options
  const swatches = product.customizations?.finishes?.slice(0, 4) || 
                   product.customizations?.colors?.slice(0, 4) || [];

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

  return (
    <div 
      className="group flex flex-col h-full bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container - No borders, full bleed, taller aspect ratio for Eagle Chair products */}
      <Link to={`/products/${product.slug || product.id}`} className={`block relative aspect-[3/4] overflow-hidden ${bgImage} flex-shrink-0 rounded-lg`}>
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-8 w-8 border-4 ${spinnerBorder} border-t-primary-500 rounded-full animate-spin`} />
          </div>
        )}
        <img
          src={displayImage || '/placeholder-product.jpg'}
          alt={product.name}
          onLoad={handleImageLoad}
          className={`w-full h-full object-contain transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-105`}
          style={{ mixBlendMode: 'multiply' }}
          loading="lazy"
        />
        
        {/* Overlay on hover */}
        <div
          className={`absolute inset-0 bg-black/30 flex items-center justify-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
          {product.isNew && <Tag variant="new" size="sm">New</Tag>}
          {product.featured && <Tag variant="featured" size="sm">Featured</Tag>}
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
          {product.type && (
            <>
              <span className={`${textSeparator} hidden sm:inline`}>•</span>
              <span className={`text-[10px] sm:text-xs ${textType} font-medium truncate`}>
                {product.type}
              </span>
            </>
          )}
        </div>

        {/* Product Name */}
        <Link to={`/products/${product.slug || product.id}`}>
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
            <div className="flex gap-1 sm:gap-1.5">
              {swatches.map((swatch, idx) => (
                <div
                  key={idx}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 ${borderSwatch} bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center`}
                  title={swatch}
                >
                  <span className="text-[7px] sm:text-[8px] font-bold text-white drop-shadow">
                    {swatch.substring(0, 1)}
                  </span>
                </div>
              ))}
              {(product.customizations?.finishes?.length > 4 || product.customizations?.colors?.length > 4) && (
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-dashed ${borderSwatchDashed} flex items-center justify-center text-[9px] sm:text-[10px] ${textSwatchMore}`}>
                  +
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price */}
        {priceDisplay && (
          <div className="mb-3 sm:mb-4">
            <span className={`text-lg sm:text-xl font-bold ${textPrice}`}>{priceDisplay}</span>
            {product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max && (
              <span className={`text-[10px] sm:text-xs ${textPriceNote} ml-1`}>per unit</span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2">
          <Link to={`/products/${product.slug || product.id}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full text-xs sm:text-sm">
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
            className="flex-shrink-0 px-2 sm:px-3"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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


