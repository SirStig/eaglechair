import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, CheckCircle, AlertCircle, Package, Edit } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useCartStore } from '../store/cartStore';
import apiClient from '../config/apiClient';
import { getProductImage } from '../utils/apiHelpers';

const inputClass = 'w-full px-4 py-3 border border-cream-300 bg-white text-slate-800 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base';

const QuoteRequestPage = () => {
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const items = useCartStore((state) =>
    state.isAuthenticated && state.backendCart
      ? (state.backendCart.items || [])
      : state.guestItems
  );
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      contactEmail: '',
      contactName: '',
      contactPhone: '',
      repName: '',
      billingLine1: '',
      billingLine2: '',
      billingCity: '',
      billingState: '',
      billingZip: '',
      billingCountry: 'USA',
      shippingLine1: '',
      shippingLine2: '',
      shippingCity: '',
      shippingState: '',
      shippingZip: '',
      shippingCountry: 'USA',
      projectName: '',
      projectDescription: '',
      desiredDeliveryDate: '',
      specialInstructions: '',
      rushOrder: false,
    }
  });

  useEffect(() => {
    if (items.length === 0 && !submitStatus) {
      navigate('/cart');
    }
  }, [items.length, navigate, submitStatus]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxSize: 52 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      setUploadedFiles(prev => [...prev, ...acceptedFiles]);
    }
  });

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    if (items.length === 0) {
      setSubmitStatus('error');
      return;
    }
    if (!sameAsBilling && (!data.shippingLine1?.trim() || !data.shippingCity?.trim() || !data.shippingState?.trim() || !data.shippingZip?.trim())) {
      setSubmitStatus('error');
      return;
    }

    const shipping = sameAsBilling
      ? {
          line1: data.billingLine1,
          line2: data.billingLine2 || null,
          city: data.billingCity,
          state: data.billingState,
          zip: data.billingZip,
          country: data.billingCountry || 'USA'
        }
      : {
          line1: data.shippingLine1,
          line2: data.shippingLine2 || null,
          city: data.shippingCity,
          state: data.shippingState,
          zip: data.shippingZip,
          country: data.shippingCountry || 'USA'
        };

    const payload = {
      contact_email: data.contactEmail,
      contact_name: data.contactName,
      contact_phone: data.contactPhone,
      rep_name: data.repName || null,
      billing_address: {
        line1: data.billingLine1,
        line2: data.billingLine2 || null,
        city: data.billingCity,
        state: data.billingState,
        zip: data.billingZip,
        country: data.billingCountry || 'USA'
      },
      shipping_destinations: [shipping],
      project_name: data.projectName || 'Quote Request',
      project_description: data.projectDescription || '',
      desired_delivery_date: data.desiredDeliveryDate || '',
      special_instructions: data.specialInstructions || '',
      rush_order: data.rushOrder || false,
      items: items.map(item => {
        const cust = item.customizations || {};
        return {
          product_id: item.product_id ?? item.product?.id,
          quantity: item.quantity,
          selected_finish_id: cust.finish?.id ?? cust.selected_finish_id ?? item.selected_finish_id ?? null,
          selected_upholstery_id: cust.upholstery?.id ?? cust.selected_upholstery_id ?? item.selected_upholstery_id ?? null,
          item_notes: cust.custom_notes ?? cust.item_notes ?? item.item_notes ?? null,
          custom_options: cust.custom_options ?? item.custom_options ?? null
        };
      })
    };

    try {
      setIsSubmitting(true);
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append('quote_data', JSON.stringify(payload));
        uploadedFiles.forEach((file) => formData.append('files', file, file.name));
        await apiClient.upload('/api/v1/quotes/request-guest', formData);
      } else {
        await apiClient.post('/api/v1/quotes/request-guest', payload);
      }
      setSubmitStatus('success');
      if (clearCart) clearCart();
    } catch (error) {
      console.error('Error submitting quote:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 && !submitStatus) return null;

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-cream-50 py-12 flex items-center">
        <div className="container max-w-2xl mx-auto px-4">
          <Card className="bg-white border-cream-200 text-center py-12 px-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">Quote Request Received!</h1>
            <p className="text-slate-600 mb-2">
              We&apos;ve sent a confirmation to your email. Please check your inbox (and spam folder) for details.
            </p>
            <p className="text-slate-600 mb-8">
              Our sales team will review your request and reach out within 24 hours. If you have urgent questions, please contact us directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" onClick={() => navigate('/')}>
                Return to Home
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/products')}>
                Browse Products
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 py-8">
      <div className="container max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-2">Request a Quote</h1>
          <p className="text-slate-600">
            Review your items and provide your contact information. We'll send a confirmation to your email and get back to you within 24 hours.
          </p>
        </div>

        {submitStatus === 'error' && (
          <Card className="mb-6 bg-red-50 border-red-500">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-700">Error Submitting Request</h3>
                <p className="text-sm text-red-600">Please try again or contact us directly.</p>
              </div>
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            <Card className="bg-white border-cream-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-500" />
                Contact Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                  <input type="email" {...register('contactEmail', { required: true })} placeholder="you@company.com" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input type="text" {...register('contactName', { required: true })} placeholder="John Smith" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone *</label>
                  <input type="tel" {...register('contactPhone', { required: true })} placeholder="(555) 123-4567" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Rep Name <span className="text-slate-500">(optional)</span></label>
                  <input type="text" {...register('repName')} placeholder="Sales rep or contact" className={inputClass} />
                </div>
              </div>
            </Card>

            <Card className="bg-white border-cream-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Billing Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Street Address *</label>
                  <input type="text" {...register('billingLine1', { required: true })} placeholder="123 Main St" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 2 <span className="text-slate-500">(optional)</span></label>
                  <input type="text" {...register('billingLine2')} placeholder="Suite 100" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                  <input type="text" {...register('billingCity', { required: true })} placeholder="City" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                  <input type="text" {...register('billingState', { required: true })} placeholder="State" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code *</label>
                  <input type="text" {...register('billingZip', { required: true })} placeholder="12345" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <input type="text" {...register('billingCountry')} placeholder="USA" className={inputClass} />
                </div>
              </div>
            </Card>

            <Card className="bg-white border-cream-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-500" />
                Shipping Address
              </h2>
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="text-primary-500 rounded" />
                <span className="text-slate-600">Same as billing address</span>
              </label>
              {!sameAsBilling && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Street Address *</label>
                    <input type="text" {...register('shippingLine1')} placeholder="123 Main St" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 2</label>
                    <input type="text" {...register('shippingLine2')} placeholder="Suite 100" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                    <input type="text" {...register('shippingCity')} placeholder="City" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                    <input type="text" {...register('shippingState')} placeholder="State" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">ZIP Code *</label>
                    <input type="text" {...register('shippingZip')} placeholder="12345" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                    <input type="text" {...register('shippingCountry')} placeholder="USA" className={inputClass} />
                  </div>
                </div>
              )}
            </Card>

            <Card className="bg-white border-cream-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500" />
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800">Products in Quote</h2>
                </div>
                <Badge variant="primaryLight">{items.length} {items.length === 1 ? 'item' : 'items'}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => {
                  const product = item.product || {};
                  const imageUrl = getProductImage(product);
                  return (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 bg-cream-50 rounded-lg border border-cream-200">
                      <div className="flex-shrink-0 w-full sm:w-20 sm:aspect-[2/3] h-48 mx-auto sm:mx-0">
                        <img src={imageUrl} alt={product.name || 'Product'} className="w-full h-full object-contain rounded-lg bg-cream-200" onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder.png'; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 mb-1 truncate">{product.name || 'Product'}</h3>
                        <div className="space-y-1 mb-3">
                          {product.model_number && <p className="text-sm text-slate-600">Model: {product.model_number}</p>}
                          {product.sku && <p className="text-sm text-slate-500">SKU: {product.sku}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="defaultLight">Qty: {item.quantity}</Badge>
                          {item.customizations?.finish && <Badge variant="secondaryLight" size="sm">Finish: {item.customizations.finish.name || item.customizations.finish}</Badge>}
                          {item.customizations?.upholstery && <Badge variant="secondaryLight" size="sm">Upholstery: {item.customizations.upholstery.name || item.customizations.upholstery}</Badge>}
                        </div>
                        {(item.customizations?.custom_notes ?? item.item_notes) && (
                          <p className="text-sm text-slate-500 mt-2 italic">Note: {item.customizations?.custom_notes ?? item.item_notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-cream-200">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/cart')} className="w-full sm:w-auto">
                  <Edit className="w-4 h-4 mr-2" /> Edit Cart
                </Button>
              </div>
            </Card>

            <Card className="bg-white border-cream-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Project Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Name <span className="text-slate-500">(optional)</span></label>
                  <input type="text" {...register('projectName')} placeholder="e.g., Office Renovation 2024" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Description <span className="text-slate-500">(optional)</span></label>
                  <textarea {...register('projectDescription')} rows={4} placeholder="Tell us about your project..." className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Desired Delivery Date <span className="text-slate-500">(optional)</span></label>
                  <input type="date" {...register('desiredDeliveryDate')} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Special Instructions <span className="text-slate-500">(optional)</span></label>
                  <textarea {...register('specialInstructions')} rows={4} placeholder="Custom finishes, delivery instructions..." className={inputClass} />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="rushOrder" {...register('rushOrder')} className="w-5 h-5 text-primary-600 bg-white border-cream-300 rounded" />
                  <label htmlFor="rushOrder" className="text-sm font-medium text-slate-700 cursor-pointer">This is a rush order</label>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-1 lg:order-2">
            <Card className="lg:sticky lg:top-24 bg-white border-cream-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Reference Materials</h2>
              <p className="text-sm text-slate-600 mb-4">Upload photos, floor plans, or specifications</p>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-all min-h-[120px] flex flex-col items-center justify-center ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-cream-300 hover:border-cream-400 hover:bg-cream-50'}`}
              >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                {isDragActive ? <p className="text-primary-600 font-medium text-sm">Drop files here...</p> : <><p className="text-slate-700 mb-1 font-medium text-sm">Drag & drop or click</p><p className="text-xs text-slate-500">Images & PDFs • Max 50MB</p></>}
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative flex items-center gap-3 p-3 bg-cream-50 border border-cream-200 rounded-lg">
                      <FileText className="w-6 h-6 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
                      <button type="button" onClick={() => removeFile(index)} className="p-1 text-red-600 hover:text-red-700" aria-label="Remove file"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 pt-6 border-t border-cream-200 space-y-3">
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting || items.length === 0}>
                  {isSubmitting ? 'Submitting...' : 'Submit Quote Request'}
                </Button>
                <Button type="button" variant="outline" size="md" className="w-full" onClick={() => navigate('/cart')} disabled={isSubmitting}>
                  Back to Cart
                </Button>
                <p className="text-xs text-slate-500 text-center mt-2">By submitting, you agree to be contacted by our sales team</p>
              </div>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuoteRequestPage;
