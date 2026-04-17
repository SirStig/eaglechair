import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { SEO } from '../config/seoConfig';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useAuthStore } from '../store/authStore';
import { useSiteSettings } from '../hooks/useContent';
import { isPasskeySupported } from '../utils/passkey';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithPasskey, isAuthenticated, user, isInitializing } = useAuthStore();
  const { data: siteSettings } = useSiteSettings();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const hasRedirectedRef = useRef(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const from = location.state?.from?.pathname || '/admin/dashboard';

  useEffect(() => {
    if (isInitializing || hasRedirectedRef.current) return;
    if (isAuthenticated && user) {
      hasRedirectedRef.current = true;
      const isAdmin = user.type === 'admin' || user.role === 'super_admin' || user.role === 'admin' || user.role === 'editor';
      if (from && from !== '/login' && from !== '/') {
        navigate(from, { replace: true });
      } else if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, from, isInitializing, location.pathname]);

  const onSubmit = async (data) => {
    setError(null);
    setSuccessMessage(null);
    const result = await login({
      email: data.email,
      password: data.password,
      two_factor_code: data.two_factor_code || undefined,
    });

    if (result.success) {
      const currentUser = useAuthStore.getState().user;
      const isAdmin = currentUser?.type === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'editor';
      if (isAdmin && result.requiresSetup) {
        navigate('/admin/setup-security', { replace: true });
      } else if (from && from !== '/login' && from !== '/') {
        navigate(from, { replace: true });
      } else if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } else {
      if (result.requiresVerification) {
        navigate('/verify-email', {
          state: {
            email: data.email,
            message: 'Please verify your email address before logging in. We\'ve sent a verification link to your email.',
            from: from
          }
        });
      } else if (result.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        setError(result.error);
      } else {
        setError(result.error || 'Login failed');
      }
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const result = await loginWithPasskey();
      if (result.success) {
        const currentUser = useAuthStore.getState().user;
        const isAdmin = currentUser?.type === 'admin';
        if (isAdmin && result.requiresSetup) {
          navigate('/admin/setup-security', { replace: true });
        } else if (isAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate(from || '/', { replace: true });
        }
      } else {
        setError(result.error || 'Passkey sign-in failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
      <SEOHead {...SEO.pages.login} />
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-dark-50">Admin Login</h2>
          <p className="text-dark-200">Sign in to access the admin panel</p>
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


          {isPasskeySupported() && (
            <div className="mb-6">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading}
              >
                {passkeyLoading ? 'Signing in...' : 'Sign in with Passkey'}
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dark-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-dark-800 text-dark-300">or</span>
                </div>
              </div>
            </div>
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

            {needsTwoFactor && (
              <Input
                label="Authenticator code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                {...register('two_factor_code', {
                  required: 'Two-factor code is required',
                  minLength: { value: 6, message: 'Enter 6 digits' },
                })}
                error={errors.two_factor_code?.message}
              />
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Sign In
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
              Forgot your password?
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


