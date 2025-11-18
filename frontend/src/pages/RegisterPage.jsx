import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useSiteSettings } from '../hooks/useContent';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerAuth, isAuthenticated, user } = useAuthStore();
  const cartStore = useCartStore();
  const { data: siteSettings } = useSiteSettings();
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  
  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm({
    mode: 'onBlur'
  });

  const totalSteps = 4;

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateStep = async (currentStep) => {
    let fieldsToValidate = [];
    
    switch(currentStep) {
      case 1:
        fieldsToValidate = ['company_name', 'legal_name', 'tax_id', 'industry', 'website'];
        break;
      case 2:
        fieldsToValidate = ['rep_first_name', 'rep_last_name', 'rep_email', 'rep_phone', 'rep_title'];
        break;
      case 3:
        fieldsToValidate = [
          'billing_address_line1', 'billing_city', 'billing_state', 
          'billing_zip', 'billing_country'
        ];
        if (!sameAsBilling) {
          fieldsToValidate.push('shipping_address_line1', 'shipping_city', 'shipping_state', 'shipping_zip');
        }
        break;
      case 4:
        fieldsToValidate = ['password', 'confirmPassword', 'termsAccepted'];
        break;
    }
    
    const isValid = await trigger(fieldsToValidate);
    return isValid;
  };

  const nextStep = async () => {
    const isValid = await validateStep(step);
    if (isValid && step < totalSteps) {
      setStep(step + 1);
      setError(null);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const onSubmit = async (data) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Prepare registration data matching backend schema
      const registrationData = {
        company_name: data.company_name,
        legal_name: data.legal_name || data.company_name,
        tax_id: data.tax_id,
        industry: data.industry,
        website: data.website,
        rep_first_name: data.rep_first_name,
        rep_last_name: data.rep_last_name,
        rep_title: data.rep_title,
        rep_email: data.rep_email,
        rep_phone: data.rep_phone,
        password: data.password,
        billing_address_line1: data.billing_address_line1,
        billing_address_line2: data.billing_address_line2 || '',
        billing_city: data.billing_city,
        billing_state: data.billing_state,
        billing_zip: data.billing_zip,
        billing_country: data.billing_country,
      };

      // Add shipping address (use billing if same)
      if (sameAsBilling) {
        registrationData.shipping_address_line1 = data.billing_address_line1;
        registrationData.shipping_address_line2 = data.billing_address_line2 || '';
        registrationData.shipping_city = data.billing_city;
        registrationData.shipping_state = data.billing_state;
        registrationData.shipping_zip = data.billing_zip;
        registrationData.shipping_country = data.billing_country;
      } else {
        registrationData.shipping_address_line1 = data.shipping_address_line1;
        registrationData.shipping_address_line2 = data.shipping_address_line2 || '';
        registrationData.shipping_city = data.shipping_city;
        registrationData.shipping_state = data.shipping_state;
        registrationData.shipping_zip = data.shipping_zip;
        registrationData.shipping_country = data.shipping_country || 'USA';
      }

      // Register (backend now requires email verification)
      const result = await registerAuth(registrationData, cartStore);
      
      if (result.success) {
        // Registration successful - user needs to verify email
        navigate('/verify-email', {
          state: {
            email: registrationData.rep_email,
            message: 'Registration successful! Please check your email to verify your account.',
            type: 'success'
          }
        });
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      // Handle specific error cases
      if (err.response?.status === 409) {
        // Resource already exists (email duplicate)
        const detail = err.response?.data?.detail || '';
        if (detail.toLowerCase().includes('email')) {
          setError('This email address is already registered. Please use a different email or try logging in.');
          // Navigate back to step 2 (contact information) where email is
          setStep(2);
        } else {
          setError('A company with this information already exists. Please check your details or contact support.');
        }
      } else if (err.response?.status === 400) {
        // Bad request - validation error
        setError(err.response?.data?.detail || 'Invalid information provided. Please check all fields and try again.');
      } else {
        // Generic error
        setError(err.response?.data?.message || err.response?.data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <motion.img 
              src={siteSettings?.logoUrl || "/assets/eagle-chair-logo.png"}
              alt={siteSettings?.companyName || "Eagle Chair"}
              className="h-16 w-auto mx-auto"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-dark-50">Create Your Account</h1>
          <p className="text-dark-200">Join {siteSettings?.companyName || "Eagle Chair"} for exclusive trade pricing and services</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2 gap-1 sm:gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`
                  w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 text-sm sm:text-base
                  ${step >= s ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-400'}
                `}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`
                    flex-1 h-1 mx-1 sm:mx-2 transition-all duration-300
                    ${step > s ? 'bg-primary-600' : 'bg-dark-700'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-dark-300 px-0 sm:px-2">
            <span className="hidden xs:inline">Company</span>
            <span className="hidden xs:inline">Contact</span>
            <span className="hidden sm:inline">Address</span>
            <span className="hidden sm:inline">Security</span>
            <span className="xs:hidden text-[10px]">Step {step}/4</span>
          </div>
        </div>

        <Card className="bg-dark-800 border-dark-700">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border-2 px-4 py-3 rounded-lg mb-6 ${
                error.toLowerCase().includes('already') 
                  ? 'bg-yellow-900/30 border-yellow-600 text-yellow-200'
                  : 'bg-red-900/30 border-red-600 text-red-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {error.toLowerCase().includes('already') ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <div>
                  <p className="font-semibold">
                    {error.toLowerCase().includes('already') ? 'Account Already Exists' : 'Error'}
                  </p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {/* Step 1: Company Information */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-semibold text-dark-50 mb-4">Company Information</h2>
                  
                  <Input
                    label="Company Name *"
                    placeholder="Eagle Corporation"
                    {...register('company_name', { 
                      required: 'Company name is required',
                      maxLength: { value: 255, message: 'Too long' }
                    })}
                    error={errors.company_name?.message}
                  />

                  <Input
                    label="Legal Name"
                    placeholder="Eagle Corporation LLC (if different)"
                    {...register('legal_name', {
                      maxLength: { value: 255, message: 'Too long' }
                    })}
                    error={errors.legal_name?.message}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Tax ID / EIN *"
                      placeholder="XX-XXXXXXX"
                      {...register('tax_id', { 
                        required: 'Tax ID is required',
                        pattern: {
                          value: /^\d{2}-?\d{7}$/,
                          message: 'Invalid Tax ID format'
                        }
                      })}
                      error={errors.tax_id?.message}
                    />

                    <Input
                      label="Industry *"
                      placeholder="Hospitality, Healthcare, etc."
                      {...register('industry', { 
                        required: 'Industry is required',
                        maxLength: { value: 100, message: 'Too long' }
                      })}
                      error={errors.industry?.message}
                    />
                  </div>

                  <Input
                    label="Website"
                    type="url"
                    placeholder="https://www.yourcompany.com"
                    {...register('website', {
                      pattern: {
                        value: /^https?:\/\/.+/,
                        message: 'Please enter a valid URL'
                      }
                    })}
                    error={errors.website?.message}
                  />
                </motion.div>
              )}

              {/* Step 2: Representative Information */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-semibold text-dark-50 mb-4">Primary Contact</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="First Name *"
                      placeholder="John"
                      {...register('rep_first_name', { 
                        required: 'First name is required',
                        maxLength: { value: 100, message: 'Too long' }
                      })}
                      error={errors.rep_first_name?.message}
                    />

                    <Input
                      label="Last Name *"
                      placeholder="Doe"
                      {...register('rep_last_name', { 
                        required: 'Last name is required',
                        maxLength: { value: 100, message: 'Too long' }
                      })}
                      error={errors.rep_last_name?.message}
                    />
                  </div>

                  <Input
                    label="Title / Position *"
                    placeholder="Purchasing Manager"
                    {...register('rep_title', { 
                      required: 'Title is required',
                      maxLength: { value: 100, message: 'Too long' }
                    })}
                    error={errors.rep_title?.message}
                  />

                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="john@company.com"
                    {...register('rep_email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    error={errors.rep_email?.message}
                  />

                  <Input
                    label="Phone Number *"
                    type="tel"
                    placeholder="(555) 123-4567"
                    {...register('rep_phone', { 
                      required: 'Phone number is required',
                      pattern: {
                        value: /^[\d\s\-\(\)\+]+$/,
                        message: 'Invalid phone number'
                      }
                    })}
                    error={errors.rep_phone?.message}
                  />
                </motion.div>
              )}

              {/* Step 3: Billing & Shipping */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-semibold text-dark-50 mb-4">Billing Address</h2>

                  <Input
                    label="Address Line 1 *"
                    placeholder="123 Main Street"
                    {...register('billing_address_line1', { 
                      required: 'Address is required',
                      maxLength: { value: 255, message: 'Too long' }
                    })}
                    error={errors.billing_address_line1?.message}
                  />

                  <Input
                    label="Address Line 2"
                    placeholder="Suite 100"
                    {...register('billing_address_line2')}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="City *"
                      placeholder="New York"
                      {...register('billing_city', { 
                        required: 'City is required',
                        maxLength: { value: 100, message: 'Too long' }
                      })}
                      error={errors.billing_city?.message}
                    />

                    <Input
                      label="State *"
                      placeholder="NY"
                      {...register('billing_state', { 
                        required: 'State is required',
                        maxLength: { value: 50, message: 'Too long' }
                      })}
                      error={errors.billing_state?.message}
                    />

                    <Input
                      label="ZIP Code *"
                      placeholder="10001"
                      {...register('billing_zip', { 
                        required: 'ZIP code is required',
                        pattern: {
                          value: /^\d{5}(-\d{4})?$/,
                          message: 'Invalid ZIP code'
                        }
                      })}
                      error={errors.billing_zip?.message}
                    />
                  </div>

                  <Input
                    label="Country *"
                    defaultValue="USA"
                    {...register('billing_country', { required: 'Country is required' })}
                    error={errors.billing_country?.message}
                  />

                  <div className="border-t border-dark-700 pt-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={(e) => setSameAsBilling(e.target.checked)}
                        className="w-5 h-5 rounded border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-dark-100">Shipping address is same as billing</span>
                    </label>
                  </div>

                  {!sameAsBilling && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 pt-4"
                    >
                      <h3 className="text-lg font-semibold text-dark-50">Shipping Address</h3>

                      <Input
                        label="Address Line 1 *"
                        placeholder="456 Oak Avenue"
                        {...register('shipping_address_line1', { 
                          required: !sameAsBilling ? 'Address is required' : false 
                        })}
                        error={errors.shipping_address_line1?.message}
                      />

                      <Input
                        label="Address Line 2"
                        placeholder="Building B"
                        {...register('shipping_address_line2')}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="City *"
                          placeholder="Los Angeles"
                          {...register('shipping_city', { 
                            required: !sameAsBilling ? 'City is required' : false 
                          })}
                          error={errors.shipping_city?.message}
                        />

                        <Input
                          label="State *"
                          placeholder="CA"
                          {...register('shipping_state', { 
                            required: !sameAsBilling ? 'State is required' : false 
                          })}
                          error={errors.shipping_state?.message}
                        />

                        <Input
                          label="ZIP Code *"
                          placeholder="90001"
                          {...register('shipping_zip', { 
                            required: !sameAsBilling ? 'ZIP code is required' : false,
                            pattern: {
                              value: /^\d{5}(-\d{4})?$/,
                              message: 'Invalid ZIP code'
                            }
                          })}
                          error={errors.shipping_zip?.message}
                        />
                      </div>

                      <Input
                        label="Country"
                        defaultValue="USA"
                        {...register('shipping_country')}
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Password & Terms */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-semibold text-dark-50 mb-4">Account Security</h2>

                  <Input
                    label="Password *"
                    type="password"
                    placeholder="Enter a strong password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters'
                      },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                        message: 'Password must contain uppercase, lowercase, and number'
                      }
                    })}
                    error={errors.password?.message}
                  />

                  <Input
                    label="Confirm Password *"
                    type="password"
                    placeholder="Re-enter your password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === watch('password') || 'Passwords do not match'
                    })}
                    error={errors.confirmPassword?.message}
                  />

                  <div className="bg-dark-700/50 rounded-lg p-4 space-y-2 text-sm text-dark-200">
                    <p className="font-semibold text-dark-100">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>At least 8 characters long</li>
                      <li>Contains uppercase and lowercase letters</li>
                      <li>Contains at least one number</li>
                    </ul>
                  </div>

                  <div className="border-t border-dark-700 pt-6 space-y-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('termsAccepted', {
                          required: 'You must accept the terms and conditions'
                        })}
                        className="w-5 h-5 mt-0.5 rounded border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-dark-100">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" className="text-primary-500 hover:text-primary-400 underline">
                          Terms of Service
                        </Link>
                        {' '}and{' '}
                        <Link to="/privacy" target="_blank" className="text-primary-500 hover:text-primary-400 underline">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {errors.termsAccepted && (
                      <p className="text-sm text-red-400">{errors.termsAccepted.message}</p>
                    )}

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('marketingConsent')}
                        className="w-5 h-5 mt-0.5 rounded border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-dark-100">
                        I would like to receive marketing emails about new products, special offers, and industry insights
                      </span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-6 sm:mt-8 pt-6 border-t border-dark-700">
              <Button
                type="button"
                variant="secondary"
                onClick={prevStep}
                disabled={step === 1}
                className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
              >
                Previous
              </Button>

              {step < totalSteps ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={nextStep}
                  className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-w-[120px] min-h-[44px]"
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              )}
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700 text-center">
            <p className="text-sm text-dark-100">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-500 hover:text-primary-400 font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-center text-sm text-dark-300 mt-6">
          Need assistance?{' '}
          <Link to="/contact" className="text-primary-500 hover:text-primary-400">
            Contact Support
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
