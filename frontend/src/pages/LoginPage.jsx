import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useSiteSettings } from '../hooks/useContent';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, isInitializing } = useAuthStore();
  const cartStore = useCartStore();
  const { data: siteSettings } = useSiteSettings();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || null);
  const hasRedirectedRef = useRef(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm();

  const from = location.state?.from?.pathname || '/dashboard';

  // Redirect if already authenticated - check if admin and redirect appropriately
  // Only redirect once and wait for auth initialization to complete
  useEffect(() => {
    // Don't redirect if still initializing or already redirected
    if (isInitializing || hasRedirectedRef.current) {
      return;
    }

    if (isAuthenticated && user) {
      hasRedirectedRef.current = true;
      
      // If user is admin and trying to access admin routes, go to admin dashboard
      const isAdmin = user.type === 'admin' || 
                      user.role === 'super_admin' || 
                      user.role === 'admin' ||
                      user.role === 'editor';
      
      // Only redirect admins to admin dashboard if they were explicitly trying to access admin routes
      // Don't redirect if they're just opening the main site in a new tab (from will be '/dashboard' or '/')
      if (isAdmin && from.startsWith('/admin')) {
        // Admin was trying to access admin route, redirect to admin dashboard
        navigate('/admin/dashboard', { replace: true });
      } else if (from && from !== '/login' && !from.startsWith('/admin')) {
        // Redirect to the original destination (could be main site, dashboard, etc.)
        navigate(from, { replace: true });
      } else if (location.pathname === '/login' && from === '/dashboard') {
        // User came to login from default dashboard redirect
        // For admins, only redirect to admin dashboard if they explicitly navigated here
        // Otherwise, let them stay on main site
        // Don't auto-redirect admins - let them choose where to go
        navigate('/dashboard', { replace: true });
      } else if (location.pathname === '/login') {
        // Only redirect if we're actually on the login page and no specific destination
        // For regular users, go to dashboard
        // For admins, don't force redirect - let them access main site
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, from, isInitializing]);

  const onSubmit = async (data) => {
    setError(null);
    setSuccessMessage(null);
    
    const result = await login({
      email: data.email,
      password: data.password,
    }, cartStore);

    if (result.success) {
      // Get the updated user from the store after login
      const currentUser = useAuthStore.getState().user;
      const isAdmin = currentUser?.type === 'admin' || 
                     currentUser?.role === 'super_admin' || 
                     currentUser?.role === 'admin' ||
                     currentUser?.role === 'editor';
      
      // Redirect based on original destination, not user type
      // Only redirect admins to admin dashboard if they were explicitly trying to access admin routes
      if (isAdmin && from.startsWith('/admin')) {
        // Admin was trying to access admin route
        navigate('/admin/dashboard', { replace: true });
      } else if (from && from !== '/login' && !from.startsWith('/admin')) {
        // Redirect to the original destination (could be main site, dashboard, etc.)
        navigate(from, { replace: true });
      } else {
        // Default: go to regular dashboard for both admins and regular users
        // Admins can access admin routes via navigation if needed
        navigate('/dashboard', { replace: true });
      }
    } else {
      // Check if error is about email verification - prioritize requiresVerification flag
      if (result.requiresVerification) {
        // Redirect to verification page with user's email
        navigate('/verify-email', {
          state: {
            email: data.email,
            message: 'Please verify your email address before logging in. We\'ve sent a verification link to your email.',
            from: from
          }
        });
      } else {
        // Show error message for other login failures
        const errorMsg = result.error || 'Login failed';
        setError(errorMsg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-dark-50">Welcome Back</h2>
          <p className="text-dark-200">Sign in to manage your account and orders</p>
        </div>

        <Card className="bg-dark-800 border-dark-700">
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-900/30 border-2 border-green-600 text-green-300 px-4 py-3 rounded-lg mb-6"
            >
              {successMessage}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg mb-6"
            >
              {error}
            </motion.div>
          )}


          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
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
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register('password', {
                required: 'Password is required'
              })}
              error={errors.password?.message}
            />

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Sign In
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-dark-700 text-center">
            <p className="text-sm text-dark-200 mb-3">
              Don't have an account?
            </p>
            <Link to="/register">
              <Button variant="secondary" size="md" className="w-full">
                Create Account
              </Button>
            </Link>
          </div>
        </Card>

        <p className="text-center text-sm text-dark-300 mt-6">
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


