import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Card from './Card';
import Badge from './Badge';
import Button from './Button';

const ProductCard = ({ product, onQuickView, onAddToCart }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <Card 
      className="overflow-hidden group flex flex-col h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <Link to={`/products/${product.id}`} className="block relative aspect-square overflow-hidden bg-dark-700 flex-shrink-0">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 border-4 border-dark-500 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={product.image || '/placeholder-product.jpg'}
          alt={product.name}
          onLoad={handleImageLoad}
          className={`w-full h-full object-cover transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-110`}
          loading="lazy"
        />
        
        {/* Overlay on hover */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center gap-2"
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
        </motion.div>

        {/* Badges */}
        {product.isNew && (
          <Badge variant="success" className="absolute top-2 left-2">
            New
          </Badge>
        )}
        {product.featured && (
          <Badge variant="warning" className="absolute top-2 right-2">
            Featured
          </Badge>
        )}
      </Link>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Category */}
        {product.category && (
          <p className="text-xs text-dark-200 uppercase tracking-wider font-medium mb-2">
            {product.category}
          </p>
        )}

        {/* Product Name */}
        <Link to={`/products/${product.id}`}>
          <h3 className="text-lg font-bold text-dark-50 mb-3 hover:text-primary-500 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Short Description */}
        {(product.short_description || product.description) && (
          <p className="text-sm text-dark-100 mb-4 line-clamp-2 leading-relaxed">
            {product.short_description || product.description}
          </p>
        )}

        {/* Key Highlights */}
        <div className="flex flex-wrap gap-2 mb-4">
          {product.ada_compliant && (
            <Badge variant="info" size="sm">
              ADA
            </Badge>
          )}
          {product.is_outdoor_suitable && (
            <Badge variant="success" size="sm">
              Outdoor
            </Badge>
          )}
          {product.customizations && (product.customizations.finishes?.length > 0 || product.customizations.fabrics?.length > 0 || product.customizations.colors?.length > 0) && (
            <Badge variant="default" size="sm">
              Customizable
            </Badge>
          )}
        </div>

        {/* Dimensions - Compact */}
        {(product.width || product.depth || product.height) && (
          <div className="text-sm text-dark-100 mb-4">
            {product.width && product.depth && product.height ? (
              <span>{product.width}" × {product.depth}" × {product.height}"</span>
            ) : (
              <>
                {product.width && <span>W: {product.width}" </span>}
                {product.depth && <span>D: {product.depth}" </span>}
                {product.height && <span>H: {product.height}"</span>}
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2">
          <Link to={`/products/${product.slug || product.id}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
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
            className="flex-shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;


