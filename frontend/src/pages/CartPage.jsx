import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useCartStore } from '../store/cartStore';

const CartPage = () => {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-dark-800 py-16">
        <div className="container">
          <Card className="max-w-2xl mx-auto text-center py-16">
            <svg className="w-24 h-24 text-dark-300 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-2xl font-bold mb-4 text-dark-50">Your Cart is Empty</h2>
            <p className="text-dark-100 mb-8">
              Start adding products to request a quote for your commercial furniture needs.
            </p>
            <Link to="/products">
              <Button variant="primary" size="lg">
                Browse Products
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-dark-50">Shopping Cart</h1>
          <button
            onClick={clearCart}
            className="text-sm text-secondary-500 hover:text-secondary-600 font-medium"
          >
            Clear Cart
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <div className="flex gap-6">
                      {/* Product Image */}
                      <Link to={`/products/${item.product.id}`} className="flex-shrink-0">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1">
                        <Link to={`/products/${item.product.id}`}>
                          <h3 className="text-lg font-semibold mb-1 text-dark-50 hover:text-primary-500">
                            {item.product.name}
                          </h3>
                        </Link>
                        
                        {item.product.category && (
                          <p className="text-sm text-dark-200 mb-2">
                            {item.product.category} {item.product.subcategory && `• ${item.product.subcategory}`}
                          </p>
                        )}

                        {/* Customizations */}
                        {Object.keys(item.customizations).length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(item.customizations).map(([key, value]) => (
                              <Badge key={key} variant="default" size="sm">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center border border-dark-400 bg-dark-700 rounded-lg">
                            <button
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              className="px-3 py-1 hover:bg-dark-600 text-lg text-dark-50"
                            >
                              -
                            </button>
                            <span className="px-4 py-1 border-x border-dark-400 min-w-[3rem] text-center text-dark-50">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              className="px-3 py-1 hover:bg-dark-600 text-lg text-dark-50"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(index)}
                            className="text-sm text-secondary-500 hover:text-secondary-600 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Price (if available) */}
                      {item.product.price && (
                        <div className="text-right">
                          <p className="text-lg font-semibold text-dark-50">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-sm text-dark-200">
                            ${item.product.price.toFixed(2)} each
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Continue Shopping */}
            <Link to="/products">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <h2 className="text-xl font-bold mb-6 text-dark-50">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-dark-100">Items</span>
                  <span className="font-semibold text-dark-50">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-100">Total Quantity</span>
                  <span className="font-semibold text-dark-50">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                
                {subtotal > 0 && (
                  <>
                    <div className="border-t border-dark-500 pt-3 mt-3"></div>
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-dark-50">Subtotal</span>
                      <span className="font-bold text-primary-500">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-dark-700 border border-primary-500 rounded-lg p-4 mb-6">
                <p className="text-sm text-dark-100">
                  <strong className="text-primary-500">Note:</strong> This is a quote request cart. Final pricing and availability 
                  will be confirmed by your sales representative.
                </p>
              </div>

              <Link to="/quote-request" className="block mb-3">
                <Button variant="primary" size="lg" className="w-full">
                  Request Quote
                </Button>
              </Link>

              <Link to="/contact" className="block">
                <Button variant="outline" size="md" className="w-full">
                  Contact Sales
                </Button>
              </Link>

              {/* Additional Info */}
              <div className="mt-6 pt-6 border-t border-dark-500 space-y-3">
                <div className="flex items-start gap-2 text-sm text-dark-100">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Fast turnaround times</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-dark-100">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Custom sizing available</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-dark-100">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Nationwide shipping</span>
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


