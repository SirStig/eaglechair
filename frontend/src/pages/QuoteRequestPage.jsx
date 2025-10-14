import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

const QuoteRequestPage = () => {
  const navigate = useNavigate();
  const { items, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submitStatus, setSubmitStatus] = useState(null);
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      company: user?.company || '',
    }
  });

  // File upload with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10485760, // 10MB
    onDrop: (acceptedFiles) => {
      setUploadedFiles([...uploadedFiles, ...acceptedFiles]);
    }
  });

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    try {
      // Prepare form data with files
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('email', data.email);
      formData.append('company', data.company);
      formData.append('phone', data.phone);
      formData.append('notes', data.notes || '');
      formData.append('items', JSON.stringify(items));
      
      uploadedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/v1/quotes', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSubmitStatus('success');
        clearCart();
        setTimeout(() => {
          navigate('/quotes');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting quote:', error);
      setSubmitStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 py-8">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-dark-50">Request a Quote</h1>
          <p className="text-lg text-dark-100 mb-8">
            Fill out the form below and we'll get back to you with a detailed quote within 24 hours.
          </p>

          {submitStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-900 border-2 border-green-500 text-green-300 px-6 py-4 rounded-lg mb-6"
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-semibold">Quote Request Submitted!</h3>
                  <p className="text-sm">Your sales representative will contact you within 24 hours.</p>
                </div>
              </div>
            </motion.div>
          )}

          {submitStatus === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-secondary-900 border-2 border-secondary-600 text-secondary-300 px-6 py-4 rounded-lg mb-6"
            >
              Error submitting quote request. Please try again or contact us directly.
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Contact Information */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Full Name"
                  {...register('name', { required: 'Name is required' })}
                  error={errors.name?.message}
                />
                <Input
                  label="Email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  error={errors.email?.message}
                />
                <Input
                  label="Company Name"
                  {...register('company', { required: 'Company name is required' })}
                  error={errors.company?.message}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  {...register('phone', { required: 'Phone number is required' })}
                  error={errors.phone?.message}
                />
              </div>
            </Card>

            {/* Cart Items */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Products ({items.length})</h2>
              {items.length === 0 ? (
                <div className="text-center py-8 text-dark-200">
                  <p className="mb-4">No items in cart</p>
                  <Button variant="outline" onClick={() => navigate('/products')}>
                    Add Products
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-4 border-b border-dark-500 pb-4 last:border-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-dark-50">{item.product.name}</h3>
                        <p className="text-sm text-dark-100">Quantity: {item.quantity}</p>
                        {Object.keys(item.customizations).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(item.customizations).map(([key, value]) => (
                              <Badge key={key} variant="default" size="sm">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Additional Notes */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Additional Information</h2>
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Project Details & Special Requirements
                </label>
                <textarea
                  {...register('notes')}
                  rows={6}
                  placeholder="Tell us about your project, timeline, custom requirements, or any questions you have..."
                  className="w-full px-4 py-3 border border-dark-400 bg-dark-700 text-dark-50 placeholder-dark-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </Card>

            {/* File Upload */}
            <Card>
              <h2 className="text-2xl font-bold mb-6 text-dark-50">Upload Images or Documents</h2>
              <p className="text-sm text-dark-100 mb-4">
                Upload photos of your space, floor plans, or any reference materials (optional)
              </p>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary-500 bg-dark-700' : 'border-dark-400 hover:border-dark-300'
                }`}
              >
                <input {...getInputProps()} />
                <svg className="w-12 h-12 text-dark-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {isDragActive ? (
                  <p className="text-primary-500 font-medium">Drop files here...</p>
                ) : (
                  <>
                    <p className="text-dark-50 mb-1">Drag & drop files here, or click to select</p>
                    <p className="text-sm text-dark-200">Images and PDFs up to 10MB</p>
                  </>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-dark-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-dark-50">{file.name}</span>
                        <span className="text-xs text-dark-200">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-secondary-500 hover:text-secondary-400"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" variant="primary" size="lg" className="flex-1">
                Submit Quote Request
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuoteRequestPage;


