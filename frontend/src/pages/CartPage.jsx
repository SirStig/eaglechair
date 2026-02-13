import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useCartStore } from '../store/cartStore';
import { getProductImage, buildProductUrl } from '../utils/apiHelpers';

const CartPage = () => {
  const [brokenImageKeys, setBrokenImageKeys] = useState(() => new Set());
  const [editingNotesIndex, setEditingNotesIndex] = useState(null);
  const notesInputRef = useRef(null);

  useEffect(() => {
    if (editingNotesIndex !== null && notesInputRef.current) {
      notesInputRef.current.focus();
    }
  }, [editingNotesIndex]);
  const cartStore = useCartStore();
  const { removeItem, updateQuantity, clearCart, updateItemNotes } = cartStore;
  const items = useCartStore((state) =>
    state.isAuthenticated && state.backendCart
      ? (state.backendCart.items || [])
      : state.guestItems
  );

  const markImageBroken = (key) => setBrokenImageKeys((prev) => new Set(prev).add(key));

  const subtotal = useCartStore((state) => {
    const cartItems = state.isAuthenticated && state.backendCart
      ? (state.backendCart.items || [])
      : state.guestItems;
    return cartItems.reduce((sum, item) => {
      const priceCents = item.unit_price ?? item.product?.price ?? item.product?.base_price ?? 0;
      return sum + (priceCents * item.quantity);
    }, 0);
  });

  const isLoading = useCartStore((state) => state.isLoading);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream-50 py-16">
        <div className="container max-w-7xl mx-auto px-4">
          <Card className="max-w-2xl mx-auto text-center py-16 bg-white border-cream-200">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-cream-100 rounded-full mb-6">
              <svg className="w-12 h-12 text-cream-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-slate-800">Your Cart is Empty</h2>
            <p className="text-slate-600 mb-8 text-lg">
              Start adding products to request a quote for your commercial furniture needs.
            </p>
            <Link to="/products">
              <Button variant="primary" size="lg">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Browse Products
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 py-12">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-2">Quoting Cart</h1>
            <p className="text-slate-600">
              {items.length} {items.length === 1 ? 'item' : 'items'} • {items.reduce((sum, item) => sum + item.quantity, 0)} total units
            </p>
          </div>
          <button
            onClick={clearCart}
            className="mt-4 sm:mt-0 text-sm text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Cart
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <AnimatePresence>
              {items.map((item, index) => {
                const product = item.product || {};
                const productImage = getProductImage(product);
                const productUrl = buildProductUrl(product);
                const itemKey = item.id ?? `guest-${index}`;
                const imageBroken = brokenImageKeys.has(itemKey);
                const productName = product.name || 'Product';
                const productCategory = typeof product.category === 'object' && product.category
                  ? (product.category.name || product.category.slug || '')
                  : (product.category || '');
                const productSubcategory = typeof product.subcategory === 'object' && product.subcategory
                  ? (product.subcategory.name || product.subcategory.slug || '')
                  : (product.subcategory || '');
                const priceCents = item.unit_price ?? product.price ?? product.base_price ?? 0;

                return (
                  <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white border-cream-200 hover:shadow-lg transition-shadow overflow-hidden">
                      <div className="flex flex-col md:flex-row gap-6">
                        <Link to={productUrl} className="flex-shrink-0">
                          <div className="relative w-28 sm:w-32 aspect-[3/4] bg-cream-50 rounded-lg overflow-hidden border border-cream-200 flex items-center justify-center mx-auto sm:mx-0">
                            {imageBroken ? (
                              <div className="absolute inset-0 flex items-center justify-center text-cream-400">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            ) : (
                              <img
                                src={productImage}
                                alt={productName}
                                onError={() => markImageBroken(itemKey)}
                                className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                                style={{ mixBlendMode: 'multiply' }}
                              />
                            )}
                          </div>
                        </Link>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          {/* Title and Category */}
                          <div className="mb-4">
                            <Link to={productUrl}>
                              <h3 className="text-xl font-bold mb-2 text-slate-800 hover:text-primary-600 transition-colors">
                                {productName}
                              </h3>
                            </Link>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              {productCategory && (
                                <span className="text-slate-600">
                                  {productCategory}
                                </span>
                              )}
                              {productSubcategory && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600">
                                    {productSubcategory}
                                  </span>
                                </>
                              )}
                              {product.model_number && (
                                <>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500 font-mono text-xs">
                                    Model: {product.model_number}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Product Description */}
                          {product.short_description && (
                            <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                              {product.short_description}
                            </p>
                          )}

                          {/* Customizations */}
                          {item.customizations && Object.keys(item.customizations).filter(key => key !== 'custom_notes' && key !== 'item_notes' && item.customizations[key]).length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Selected Options</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.customizations).map(([key, value]) => {
                                  if (key === 'custom_notes' || key === 'item_notes' || !value) return null;
                                  const displayValue = typeof value === 'object'
                                    ? (value.name || value.slug || value.sku || value.label || '')
                                    : String(value);
                                  if (!displayValue) return null;
                                  return (
                                    <div key={key} className="bg-primary-50 border border-primary-200 text-primary-700 px-3 py-1.5 rounded-md text-sm font-medium">
                                      <span className="capitalize">{key}</span>: <span className="font-semibold">{displayValue}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Custom Notes / Requests */}
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Custom Requests / Notes</p>
                            {editingNotesIndex === index ? (
                              <div>
                                <textarea
                                  ref={notesInputRef}
                                  defaultValue={item.customizations?.custom_notes ?? item.item_notes ?? ''}
                                  placeholder="Add custom requests or notes for this product..."
                                  rows={3}
                                  className="w-full px-3 py-2 border border-cream-300 bg-white text-slate-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-y mb-2"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = notesInputRef.current?.value?.trim() || null;
                                      updateItemNotes(index, val);
                                      setEditingNotesIndex(null);
                                    }}
                                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNotesIndex(null)}
                                    className="text-sm text-slate-500 hover:text-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingNotesIndex(index)}
                                className="w-full text-left p-3 bg-cream-50 border border-cream-200 rounded-lg hover:border-cream-300 transition-colors group"
                              >
                                {(item.customizations?.custom_notes ?? item.item_notes) ? (
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.customizations?.custom_notes ?? item.item_notes}</p>
                                ) : (
                                  <p className="text-sm text-slate-500 italic">Click to add custom requests or notes...</p>
                                )}
                                <span className="text-xs text-slate-400 mt-1 block group-hover:text-primary-500">Edit</span>
                              </button>
                            )}
                          </div>

                          {/* Product Specs */}
                          {(product.width || product.depth || product.height || product.lead_time_days) && (
                            <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
                              {product.width && product.depth && product.height && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                  </svg>
                                  <span>{product.width}" × {product.depth}" × {product.height}"</span>
                                </div>
                              )}
                              {product.lead_time_days && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{product.lead_time_days} day lead time</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quantity and Actions */}
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-cream-200">
                            <div className="flex items-center gap-4">
                              {/* Quantity Controls */}
                              <div className="flex items-center border-2 border-cream-300 bg-white rounded-lg shadow-sm">
                                <button
                                  onClick={() => updateQuantity(index, item.quantity - 1)}
                                  className="px-4 py-2.5 hover:bg-cream-50 text-lg text-slate-700 transition-colors font-semibold min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="px-4 sm:px-5 py-2.5 border-x-2 border-cream-300 min-w-[3rem] sm:min-w-[4rem] text-center text-slate-800 font-bold">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(index, item.quantity + 1)}
                                  className="px-4 py-2.5 hover:bg-cream-50 text-lg text-slate-700 transition-colors font-semibold min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => removeItem(index)}
                                className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove
                              </button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              {priceCents > 0 ? (
                                <>
                                  <p className="text-2xl font-bold text-slate-800">
                                    ${((priceCents / 100) * item.quantity).toFixed(2)}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    Estimated listing: ${(priceCents / 100).toFixed(2)} × {item.quantity}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-slate-500 font-medium">Quote Required</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Continue Shopping */}
            <div className="pt-4">
              <Link to="/products">
                <Button variant="outline" size="lg" className="w-full border-cream-300 text-slate-700 hover:bg-white hover:border-primary-400 transition-all">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-24 bg-white border-cream-200 shadow-lg">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-slate-800 pb-4 border-b border-cream-200">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600 font-medium">Items in Cart</span>
                  <span className="font-bold text-slate-800 text-lg">{items.length}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600 font-medium">Total Units</span>
                  <span className="font-bold text-slate-800 text-lg">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>

                {subtotal > 0 && (
                  <>
                    <div className="border-t border-cream-200 my-4"></div>
                    <div className="flex justify-between items-baseline py-2 bg-primary-50 -mx-6 px-6 py-4 rounded-lg">
                      <span className="font-bold text-slate-800 text-lg">Estimated Subtotal (listing/base prices)</span>
                      <span className="font-bold text-primary-600 text-2xl">
                        ${(subtotal / 100).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 text-center italic mt-2">
                      *Prices are estimated listing/base only. Final pricing subject to quote approval and may be higher.
                    </p>
                  </>
                )}
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Quote Request Cart</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Submit your selections for a detailed quote. Our team will review and provide final pricing, availability, and delivery estimates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link to="/quote-request" className="block">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full shadow-md hover:shadow-lg transition-shadow"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Request Quote
                  </Button>
                </Link>

                <Link to="/contact" className="block">
                  <Button variant="outline" size="md" className="w-full border-2 border-cream-300 text-slate-700 hover:bg-white hover:border-primary-400 transition-all">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact Sales Team
                  </Button>
                </Link>
              </div>

              {/* Benefits */}
              <div className="mt-8 pt-6 border-t border-cream-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Why Choose Us</h3>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Fast Turnaround</p>
                    <p className="text-slate-600 text-xs">Most orders ship within lead time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Custom Options</p>
                    <p className="text-slate-600 text-xs">Tailored sizing and finishes available</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Nationwide Delivery</p>
                    <p className="text-slate-600 text-xs">Professional shipping across the US</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Expert Support</p>
                    <p className="text-slate-600 text-xs">Dedicated sales team assistance</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;


