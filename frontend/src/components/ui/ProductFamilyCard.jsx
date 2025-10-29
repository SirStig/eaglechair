import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import Tag from './Tag';

/**
 * ProductFamilyCard Component
 * 
 * Displays a product family in the catalog with:
 * - Family banner/hero image
 * - Family name and description
 * - Product count badge
 * - Quick view and detail view options
 * - Featured tag
 */
const ProductFamilyCard = ({ family, onQuickView, darkMode = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Get family image (banner_image_url or family_image)
  const familyImage = family.banner_image_url || family.family_image || '/placeholder-family.jpg';
  
  // Get product count
  const productCount = family.product_count || family.products?.length || 0;

  // Dark mode color classes
  const bgImage = darkMode ? 'bg-dark-800' : 'bg-cream-100';
  const textCategory = darkMode ? 'text-dark-300' : 'text-slate-500';
  const textTitle = darkMode ? 'text-dark-50' : 'text-slate-800';
  const textTitleHover = darkMode ? 'hover:text-primary-400' : 'hover:text-primary-600';
  const textDescription = darkMode ? 'text-dark-200' : 'text-slate-600';
  const textProductCount = darkMode ? 'text-dark-300' : 'text-slate-600';
  const spinnerBorder = darkMode ? 'border-dark-600' : 'border-cream-300';
  const bgCard = darkMode ? 'bg-dark-800' : 'bg-white';
  const borderCard = darkMode ? 'border-dark-700' : 'border-cream-200';

  // Build family URL
  const familyUrl = `/families/${family.slug || family.id}`;

  return (
    <div 
      className={`group flex flex-col h-full ${bgCard} border ${borderCard} rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container - Portrait aspect ratio for family banners */}
      <Link to={familyUrl} className={`block relative aspect-[3/4] overflow-hidden ${bgImage} flex-shrink-0 rounded-lg`}>
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-8 w-8 border-4 ${spinnerBorder} border-t-primary-500 rounded-full animate-spin`} />
          </div>
        )}
        <img
          src={familyImage}
          alt={family.name}
          onLoad={handleImageLoad}
          className={`w-full h-full object-contain transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-105`}
          style={{ mixBlendMode: 'multiply' }}
          loading="lazy"
        />
        
        {/* Overlay on hover */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.(family);
            }}
          >
            Quick View
          </Button>
        </div>

        {/* Tags */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {family.is_featured && <Tag variant="featured" size="sm">Featured Family</Tag>}
        </div>

        {/* Product Count Badge */}
        <div className="absolute top-3 right-3">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
            <span className="text-xs font-semibold text-slate-800">
              {productCount} {productCount === 1 ? 'Product' : 'Products'}
            </span>
          </div>
        </div>
      </Link>

      {/* Family Info - Below Image */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Category */}
        {family.category_name && (
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs ${textCategory} uppercase tracking-wider font-medium`}>
              {family.category_name}
            </span>
          </div>
        )}

        {/* Family Name */}
        <Link to={familyUrl}>
          <h3 className={`text-xl font-bold ${textTitle} mb-2 ${textTitleHover} transition-colors line-clamp-2`}>
            {family.name}
          </h3>
        </Link>

        {/* Description or Overview */}
        {(family.overview_text || family.description) && (
          <p className={`text-sm ${textDescription} mb-4 line-clamp-3 leading-relaxed`}>
            {family.overview_text || family.description}
          </p>
        )}

        {/* Product Count Text */}
        <p className={`text-xs ${textProductCount} mb-4`}>
          Browse {productCount} {productCount === 1 ? 'variation' : 'variations'} in this family
        </p>

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2">
          <Link to={familyUrl} className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Explore Family
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onQuickView?.(family);
            }}
            className="flex-shrink-0 px-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductFamilyCard;
