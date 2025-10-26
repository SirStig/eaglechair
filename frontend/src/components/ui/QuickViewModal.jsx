import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import Tag from './Tag';
import { useCartStore } from '../../store/cartStore';
import logger from '../../utils/logger';

const CONTEXT = 'QuickViewModal';

const QuickViewModal = ({ product, isOpen, onClose }) => {
  const { addItem } = useCartStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState(null);
  const [selectedUpholstery, setSelectedUpholstery] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setQuantity(1);
      
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
    };
    addItem(product, quantity, customizations);
    logger.info(CONTEXT, `Added to cart: ${product.name} x${quantity}`);
    onClose();
  };

  if (!product) return null;

  const images = product.images || [product.image];

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
                    {(product.price || product.priceRange) && (
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-slate-900">
                          {product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max
                            ? `$${product.priceRange.min.toFixed(2)} - $${product.priceRange.max.toFixed(2)}`
                            : `$${((product.price || product.priceRange?.min) || 0).toFixed(2)}`}
                        </span>
                        {product.priceRange?.min && product.priceRange?.max && product.priceRange.min !== product.priceRange.max && (
                          <span className="text-sm text-slate-500 ml-2">per unit</span>
                        )}
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

                    {/* Customization Options */}
                    <div className="space-y-3 mb-6">
                      {/* Finishes */}
                      {product.customizations?.finishes && product.customizations.finishes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Finish
                          </label>
                          <select
                            value={selectedFinish || ''}
                            onChange={(e) => setSelectedFinish(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            {product.customizations.finishes.map((finish, idx) => (
                              <option key={idx} value={finish}>{finish}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Fabrics */}
                      {product.customizations?.fabrics && product.customizations.fabrics.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Upholstery
                          </label>
                          <select
                            value={selectedUpholstery || ''}
                            onChange={(e) => setSelectedUpholstery(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            {product.customizations.fabrics.map((fabric, idx) => (
                              <option key={idx} value={fabric}>{fabric}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Colors */}
                      {product.customizations?.colors && product.customizations.colors.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Color
                          </label>
                          <select
                            value={selectedColor || ''}
                            onChange={(e) => setSelectedColor(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            {product.customizations.colors.map((color, idx) => (
                              <option key={idx} value={color}>{color}</option>
                            ))}
                          </select>
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
                      <Link to={`/products/${product.slug || product.id}`} onClick={onClose} className="block">
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

