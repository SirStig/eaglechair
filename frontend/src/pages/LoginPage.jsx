import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { demoUser, demoAdminUser, IS_DEMO } from '../data/demoData';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm();

  const from = location.state?.from?.pathname || '/dashboard';

  const onSubmit = async (data) => {
    setError(null);
    
    if (IS_DEMO) {
      // Demo mode - simple email check
      const isAdmin = data.email.includes('admin');
      const demoUserData = isAdmin ? demoAdminUser : demoUser;
      
      const result = await login({
        email: data.email,
        password: data.password,
      });
      
      // Simulate successful login in demo mode
      if (data.email && data.password) {
        // Override with demo user
        useAuthStore.setState({ 
          user: demoUserData, 
          isAuthenticated: true,
          token: 'demo-token'
        });
        navigate(from, { replace: true });
      } else {
        setError('Please enter valid credentials');
      }
    } else {
      // Real API mode
      const result = await login({
        email: data.email,
        password: data.password,
      });

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img 
              src="/assets/eagle-chair-logo.png" 
              alt="Eagle Chair" 
              className="h-16 w-auto mx-auto opacity-80"
            />
          </Link>
          <h2 className="text-2xl font-bold mb-2 text-dark-50">
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-dark-100">
            {isRegistering 
              ? 'Register your business account to get started' 
              : 'Sign in to manage quotes and orders'}
          </p>
        </div>

        <Card>
          {error && (
            <div className="bg-secondary-900 border-2 border-secondary-600 text-secondary-300 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {IS_DEMO && (
            <div className="bg-dark-700 border-2 border-primary-500 text-dark-100 px-4 py-3 rounded-lg mb-6 text-sm">
              <strong className="text-primary-500">Demo Mode:</strong> Use any email/password to login.
              <br/>Try: demo@eaglechair.com or admin@eaglechair.com
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {isRegistering && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    {...register('firstName', { required: isRegistering })}
                    error={errors.firstName?.message}
                  />
                  <Input
                    label="Last Name"
                    {...register('lastName', { required: isRegistering })}
                    error={errors.lastName?.message}
                  />
                </div>
                <Input
                  label="Company Name"
                  {...register('company', { required: isRegistering })}
                  error={errors.company?.message}
                />
              </>
            )}

            <Input
              label="Email Address"
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
              label="Password"
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: isRegistering ? 6 : 1,
                  message: 'Password must be at least 6 characters'
                }
              })}
              error={errors.password?.message}
            />

            {isRegistering && (
              <>
                <Input
                  label="Confirm Password"
                  type="password"
                  {...register('confirmPassword', {
                    required: isRegistering,
                    validate: (value) =>
                      value === watch('password') || 'Passwords do not match'
                  })}
                  error={errors.confirmPassword?.message}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  {...register('phone')}
                />
              </>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full">
              {isRegistering ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {!isRegistering && (
            <div className="mt-4 text-center">
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
                Forgot your password?
              </a>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-dark-500 text-center">
            <p className="text-sm text-dark-100">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              {' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                className="text-primary-500 hover:text-primary-400 font-medium"
              >
                {isRegistering ? 'Sign In' : 'Register'}
              </button>
            </p>
          </div>
        </Card>

        <p className="text-center text-sm text-dark-100 mt-6">
          Need help?{' '}
          <Link to="/contact" className="text-primary-500 hover:text-primary-400">
            Contact Support
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;


