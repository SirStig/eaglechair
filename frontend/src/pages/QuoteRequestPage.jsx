import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, AlertCircle, Package, Edit } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import apiClient from '../config/apiClient';
import { getProductImage } from '../utils/apiHelpers';

const QuoteRequestPage = () => {
  const navigate = useNavigate();
  const cartStore = useCartStore();
  const { clearCart } = cartStore;
  
  // Subscribe to cart state properly - this will trigger re-renders on cart changes
  const items = useCartStore((state) => {
    return state.isAuthenticated && state.backendCart 
      ? (state.backendCart.items || [])
      : state.guestItems;
  });
  
  const { user, isAuthenticated } = useAuthStore();
  
  // Check if user needs email verification
  const isUnverified = user && user.type === 'company' && !user.isVerified;
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadPreviews, setUploadPreviews] = useState([]);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartSynced, setCartSynced] = useState(false);
  
  // Ensure cart is synced when authenticated user visits quote request page
  useEffect(() => {
    const syncCart = async () => {
      // Only sync once and if user is authenticated but cart store isn't in auth mode
      if (isAuthenticated && !cartStore.isAuthenticated && !cartSynced) {
        console.log('QuoteRequestPage: User authenticated but cart not synced, switching to auth mode');
        setCartSynced(true); // Prevent multiple calls
        await cartStore.switchToAuthMode();
      }
    };
    
    syncCart();
  }, [isAuthenticated, cartStore.isAuthenticated, cartSynced, cartStore]);
  
  // Debug logging
  useEffect(() => {
    console.log('QuoteRequestPage - items:', items);
    console.log('QuoteRequestPage - user:', user);
    console.log('QuoteRequestPage - cartStore.isAuthenticated:', cartStore.isAuthenticated);
    console.log('QuoteRequestPage - isAuthenticated:', isAuthenticated);
  }, [items.length, user?.id, cartStore.isAuthenticated, isAuthenticated]);
  
  const { register, handleSubmit } = useForm({
    defaultValues: {
      projectName: '',
      projectDescription: '',
      desiredDeliveryDate: '',
      specialInstructions: '',
      rushOrder: false,
    }
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/quote-request');
    }
  }, [user, navigate]);

  // Redirect if cart is empty (but only after checking we have items)
  useEffect(() => {
    if (user && items.length === 0 && !submitStatus) {
      console.log('Redirecting to cart - no items found');
      navigate('/cart');
    }
  }, [user, items.length, navigate, submitStatus]);

  // File upload with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10485760, // 10MB
    onDrop: (acceptedFiles) => {
      setUploadedFiles([...uploadedFiles, ...acceptedFiles]);
      
      // Create preview URLs for images
      acceptedFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setUploadPreviews(prev => [...prev, {
              name: file.name,
              url: reader.result
            }]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  });

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
    setUploadPreviews(uploadPreviews.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    if (items.length === 0) {
      setSubmitStatus('error');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Prepare quote data matching backend schema
      const quoteData = {
        contact_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.companyName,
        contact_email: user.email,
        contact_phone: user.phone || '',
        project_name: data.projectName || 'Quote Request',
        project_description: data.projectDescription || '',
        desired_delivery_date: data.desiredDeliveryDate || '',
        shipping_address_line1: user.billingAddress?.line1 || '',
        shipping_address_line2: user.billingAddress?.line2 || '',
        shipping_city: user.billingAddress?.city || '',
        shipping_state: user.billingAddress?.state || '',
        shipping_zip: user.billingAddress?.zip || '',
        shipping_country: user.billingAddress?.country || 'USA',
        special_instructions: data.specialInstructions || '',
        rush_order: data.rushOrder || false,
      };

      // If we have files, use multipart/form-data
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        
        // Append quote data as JSON string
        formData.append('quote_data', JSON.stringify(quoteData));
        
        // Append files
        uploadedFiles.forEach((file) => {
          formData.append('files', file, file.name);
        });

        await apiClient.upload('/api/v1/quotes/request', formData);
      } else {
        // No files, send as JSON
        await apiClient.post('/api/v1/quotes/request', quoteData);
      }
      
      setSubmitStatus('success');
      if (clearCart) clearCart();
      
      setTimeout(() => {
        navigate('/dashboard/quotes');
      }, 2000);
    } catch (error) {
      console.error('Error submitting quote:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-dark-50 mb-2">Request a Quote</h1>
          <p className="text-dark-200">
            Review your items and provide project details. We'll get back to you within 24 hours.
          </p>
        </div>

        {/* Verification Required Banner */}
        {isUnverified && (
          <Card className="mb-6 bg-yellow-900/20 border-yellow-600">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-300 mb-1">Email Verification Required</h3>
                <p className="text-sm text-yellow-200/80 mb-3">
                  Please verify your email address before creating quote requests. Check your email for the verification link or{' '}
                  <button
                    onClick={() => navigate('/verify-email', { state: { email: user?.email } })}
                    className="underline hover:text-yellow-300 font-medium"
                  >
                    resend verification email
                  </button>
                  .
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/verify-email', { state: { email: user?.email } })}
                >
                  Go to Verification Page
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Status Messages */}
        {submitStatus === 'success' && (
          <Card className="mb-6 bg-green-900/20 border-green-500">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-400">Quote Request Submitted!</h3>
                <p className="text-sm text-green-300">Redirecting to your quotes...</p>
              </div>
            </div>
          </Card>
        )}

        {submitStatus === 'error' && (
          <Card className="mb-6 bg-red-900/20 border-red-500">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="font-semibold text-red-400">Error Submitting Request</h3>
                <p className="text-sm text-red-300">Please try again or contact us directly.</p>
              </div>
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Cart Items (2/3 width) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            {/* Cart Items Review */}
            <Card>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />
                    <h2 className="text-lg sm:text-xl font-bold text-dark-50">Products in Quote</h2>
                  </div>
                  <Badge variant="primary">{items.length} {items.length === 1 ? 'item' : 'items'}</Badge>
                </div>
              
              <div className="space-y-3">
                {items.map((item, index) => {
                  const product = item.product || {};
                  const imageUrl = getProductImage(product);
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 bg-dark-700/50 rounded-lg border border-dark-600 hover:border-dark-500 transition-colors">
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-full sm:w-24 h-48 sm:h-24 mx-auto sm:mx-0">
                        <img
                          src={imageUrl}
                          alt={product.name || 'Product'}
                          className="w-full h-full object-cover rounded-lg bg-dark-600"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/placeholder.png';
                          }}
                        />
                      </div>
                      
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-dark-50 mb-1 truncate">{product.name}</h3>
                        
                        <div className="space-y-1 mb-3">
                          {product.model_number && (
                            <p className="text-sm text-dark-200">Model: {product.model_number}</p>
                          )}
                          {product.sku && (
                            <p className="text-sm text-dark-300">SKU: {product.sku}</p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">Qty: {item.quantity}</Badge>
                          
                          {item.selected_finish && (
                            <Badge variant="secondary" size="sm">
                              Finish: {item.selected_finish.name || item.selected_finish}
                            </Badge>
                          )}
                          
                          {item.selected_upholstery && (
                            <Badge variant="secondary" size="sm">
                              Upholstery: {item.selected_upholstery.name || item.selected_upholstery}
                            </Badge>
                          )}
                          
                          {item.customizations && Object.entries(item.customizations).map(([key, value]) => (
                            <Badge key={key} variant="secondary" size="sm">
                              {key}: {value}
                            </Badge>
                          ))}
                          
                          {item.configuration && Object.keys(item.configuration).length > 0 && (
                            <Badge variant="secondary" size="sm">
                              Custom Configuration
                            </Badge>
                          )}
                        </div>
                        
                        {item.custom_notes && (
                          <p className="text-sm text-dark-300 mt-2 italic">Note: {item.custom_notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-dark-600 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-sm text-dark-300">
                  Need to make changes to your selection?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/cart')}
                  className="w-full sm:w-auto"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Cart
                </Button>
              </div>
            </Card>

            {/* Project Information */}
            <Card>
              <h2 className="text-lg sm:text-xl font-bold text-dark-50 mb-4 sm:mb-6">Project Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Project Name <span className="text-dark-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    {...register('projectName')}
                    placeholder="e.g., Office Renovation 2024"
                    className="w-full px-4 py-3 border border-dark-500 bg-dark-700 text-dark-50 placeholder-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Project Description <span className="text-dark-300">(optional)</span>
                  </label>
                  <textarea
                    {...register('projectDescription')}
                    rows={4}
                    placeholder="Tell us about your project, intended use, or any specific requirements..."
                    className="w-full px-4 py-3 border border-dark-500 bg-dark-700 text-dark-50 placeholder-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Desired Delivery Date <span className="text-dark-300">(optional)</span>
                  </label>
                  <input
                    type="date"
                    {...register('desiredDeliveryDate')}
                    className="w-full px-4 py-3 border border-dark-500 bg-dark-700 text-dark-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>
              </div>
            </Card>

            {/* Special Instructions */}
            <Card>
              <h2 className="text-lg sm:text-xl font-bold text-dark-50 mb-4 sm:mb-6">Additional Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Special Instructions or Questions <span className="text-dark-300">(optional)</span>
                  </label>
                  <textarea
                    {...register('specialInstructions')}
                    rows={6}
                    placeholder="Custom finishes, special hardware requirements, delivery instructions, budget constraints, or any questions..."
                    className="w-full px-4 py-3 border border-dark-500 bg-dark-700 text-dark-50 placeholder-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="rushOrder"
                    {...register('rushOrder')}
                    className="w-5 h-5 sm:w-4 sm:h-4 text-primary-600 bg-dark-700 border-dark-500 rounded focus:ring-primary-500 flex-shrink-0"
                  />
                  <label htmlFor="rushOrder" className="text-sm font-medium text-dark-100 cursor-pointer">
                    This is a rush order (expedited processing)
                  </label>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - File Upload & Submit (1/3 width) */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* File Upload */}
            <Card className="lg:sticky lg:top-4">
              <h2 className="text-lg sm:text-xl font-bold text-dark-50 mb-2">Reference Materials</h2>
              <p className="text-sm text-dark-200 mb-4">
                Upload photos, floor plans, inspiration images, or specifications
              </p>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-all min-h-[120px] sm:min-h-[160px] flex flex-col items-center justify-center ${
                  isDragActive 
                    ? 'border-primary-500 bg-primary-900/10' 
                    : 'border-dark-500 hover:border-dark-400 hover:bg-dark-700'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-dark-300 mx-auto mb-3" />
                {isDragActive ? (
                  <p className="text-primary-400 font-medium text-sm">Drop files here...</p>
                ) : (
                  <>
                    <p className="text-dark-50 mb-1 font-medium text-sm">Drag & drop files</p>
                    <p className="text-xs text-dark-300">or click to browse</p>
                    <p className="text-xs text-dark-400 mt-2">Images & PDFs • Max 10MB</p>
                  </>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-dark-100 mb-3">
                    Uploaded Files ({uploadedFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.type.startsWith('image/') ? (
                          <div className="aspect-video rounded-lg overflow-hidden bg-dark-700 border border-dark-600">
                            <img
                              src={uploadPreviews[index]?.url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-dark-700 border border-dark-600 rounded-lg">
                            <FileText className="w-8 h-8 text-dark-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-dark-200 truncate">{file.name}</p>
                              <p className="text-xs text-dark-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-[32px] min-h-[32px] flex items-center justify-center"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-6 pt-6 border-t border-dark-600 space-y-3">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting || items.length === 0 || isUnverified}
                  title={isUnverified ? 'Email verification required to submit quotes' : ''}
                >
                  {isSubmitting ? 'Submitting...' : isUnverified ? 'Verification Required' : 'Submit Quote Request'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="md" 
                  className="w-full"
                  onClick={() => navigate('/cart')}
                  disabled={isSubmitting}
                >
                  Back to Cart
                </Button>
                <p className="text-xs text-dark-400 text-center mt-2">
                  By submitting, you agree to be contacted by our sales team
                </p>
              </div>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuoteRequestPage;


