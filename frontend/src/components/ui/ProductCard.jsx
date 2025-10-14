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
      className="overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <Link to={`/products/${product.id}`} className="block relative aspect-square overflow-hidden bg-dark-700">
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
      <div className="p-4">
        {product.category && (
          <p className="text-xs text-dark-200 uppercase tracking-wider mb-1">
            {product.category}
          </p>
        )}
        <Link to={`/products/${product.id}`}>
          <h3 className="text-lg font-semibold text-dark-50 mb-2 hover:text-primary-500 transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>
        {product.description && (
          <p className="text-sm text-dark-100 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Specs */}
        {product.specs && (
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(product.specs).slice(0, 2).map(([key, value]) => (
              <Badge key={key} variant="default" size="sm">
                {key}: {value}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onAddToCart?.(product)}
          >
            Add to Cart
          </Button>
          <Link to={`/products/${product.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Details
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;


