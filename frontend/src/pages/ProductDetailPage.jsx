import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductCard from '../components/ui/ProductCard';
import { useCartStore } from '../store/cartStore';
import { demoProducts, IS_DEMO } from '../data/demoData';

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customizations, setCustomizations] = useState({});
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    
    if (IS_DEMO) {
      const foundProduct = demoProducts.find(p => p.id === parseInt(id) || p.slug === id);
      
      if (foundProduct) {
        setProduct(foundProduct);
        
        // Find related products in same category
        const related = demoProducts
          .filter(p => p.category === foundProduct.category && p.id !== foundProduct.id)
          .slice(0, 4);
        setRelatedProducts(related);
        
        // Initialize customizations with first option
        if (foundProduct.customizations) {
          const initial = {};
          Object.keys(foundProduct.customizations).forEach(key => {
            initial[key] = foundProduct.customizations[key][0];
          });
          setCustomizations(initial);
        }
      } else {
        navigate('/products');
      }
      setLoading(false);
    } else {
      try {
        const response = await fetch(`/api/v1/products/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data.product);
          setRelatedProducts(data.related || []);
        } else {
          navigate('/products');
        }
      } catch (error) {
        console.error('Error loading product:', error);
        navigate('/products');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddToCart = () => {
    addItem(product, quantity, customizations);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!product) {
    return null;
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-dark-100">
          <Link to="/" className="hover:text-primary-500">Home</Link>
          {' '}/{' '}
          <Link to="/products" className="hover:text-primary-500">Products</Link>
          {' '}/{' '}
          <Link to={`/products?category=${product.category}`} className="hover:text-primary-500">
            {product.category}
          </Link>
          {' '}/{' '}
          <span className="text-dark-50">{product.name}</span>
        </div>

        {/* Product Details */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Images */}
          <div>
            <Card padding="none" className="overflow-hidden mb-4">
              <div className="relative aspect-square bg-dark-700">
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.isNew && (
                  <Badge variant="success" className="absolute top-4 left-4">
                    New
                  </Badge>
                )}
                {product.featured && (
                  <Badge variant="warning" className="absolute top-4 right-4">
                    Featured
                  </Badge>
                )}
              </div>
            </Card>
            
            {/* Thumbnail Grid */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`relative aspect-square rounded-lg overflow-hidden ${
                      selectedImage === index ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-110 transition-transform"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <p className="text-sm text-dark-200 uppercase tracking-wider mb-2">
                {product.category} {product.subcategory && `• ${product.subcategory}`}
              </p>
            )}
            
            <h1 className="text-4xl font-bold mb-4 text-dark-50">{product.name}</h1>
            
            <p className="text-lg text-dark-100 mb-6">{product.description}</p>

            {/* Customizations */}
            {product.customizations && Object.keys(product.customizations).length > 0 && (
              <Card className="mb-6">
                <h3 className="font-semibold mb-4 text-dark-50">Customize Your Product</h3>
                {Object.entries(product.customizations).map(([key, options]) => (
                  <div key={key} className="mb-4">
                    <label className="block text-sm font-medium text-dark-100 mb-2 capitalize">
                      {key}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {options.map((option) => (
                        <button
                          key={option}
                          onClick={() => setCustomizations({ ...customizations, [key]: option })}
                          className={`px-4 py-2 border rounded-lg transition-all ${
                            customizations[key] === option
                              ? 'border-primary-500 bg-primary-900 text-primary-300'
                              : 'border-dark-400 hover:border-dark-300 text-dark-100'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* 3D Rendering Placeholder */}
            <Card className="mb-6 bg-gradient-to-r from-primary-900 to-dark-700 border-primary-500">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎨</div>
                <div>
                  <h4 className="font-semibold text-dark-50">3D Customization</h4>
                  <p className="text-sm text-dark-100">
                    Coming Soon: Visualize your customizations in 3D
                  </p>
                </div>
              </div>
            </Card>

            {/* Quantity and Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Quantity
                </label>
                <div className="flex items-center border border-dark-400 bg-dark-700 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-dark-600 text-dark-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center border-x border-dark-400 bg-dark-700 text-dark-50 py-2"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 hover:bg-dark-600 text-dark-50"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-dark-100 mb-2">&nbsp;</label>
                <Button
                  onClick={handleAddToCart}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Add to Cart
                </Button>
              </div>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-900 border-2 border-green-500 text-green-300 px-4 py-3 rounded-lg mb-6"
              >
                ✓ Added to cart successfully!
              </motion.div>
            )}

            {/* Additional Actions */}
            <div className="flex gap-3">
              <Link to="/quote-request" className="flex-1">
                <Button variant="outline" size="md" className="w-full">
                  Request Quote
                </Button>
              </Link>
              <Link to="/contact" className="flex-1">
                <Button variant="outline" size="md" className="w-full">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Specifications */}
        {product.specs && (
          <Card className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-dark-50">Specifications</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="border-b border-dark-500 pb-2">
                  <dt className="text-sm font-medium text-dark-200">{key}</dt>
                  <dd className="text-lg font-semibold mt-1 text-dark-50">{value}</dd>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Features */}
        {product.features && product.features.length > 0 && (
          <Card className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-dark-50">Features</h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {product.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <svg className="h-6 w-6 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-dark-100">{feature}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-dark-50">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;


