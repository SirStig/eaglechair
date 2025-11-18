import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useSiteSettings } from '../hooks/useContent';

const ResetPasswordPage = () => {
  const { data: siteSettings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  const token = searchParams.get('token');

  const validatePassword = () => {
    const errors = {};
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])/.test(password)) {
      errors.password = 'Password must contain a lowercase letter';
    } else if (!/(?=.*[A-Z])/.test(password)) {
      errors.password = 'Password must contain an uppercase letter';
    } else if (!/(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain a number';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validatePassword()) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      await axios.post('/api/v1/auth/password/reset', {
        token,
        new_password: password
      });
      
      // Success - redirect to login with success message
      navigate('/login', { 
        state: { 
          message: 'Password reset successful! Please log in with your new password.',
          type: 'success'
        } 
      });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
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
          </div>

          <Card className="bg-dark-800 border-dark-700 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="mb-6 text-red-500"
            >
              <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-dark-50">Invalid Reset Link</h2>
            <p className="text-dark-200 mb-8">
              This password reset link is invalid or has expired. Reset links are only valid for 1 hour.
            </p>
            <div className="space-y-3">
              <Link to="/forgot-password">
                <Button variant="primary" size="lg" className="w-full">
                  Request New Link
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="md" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

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
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-dark-50">Set New Password</h2>
          <p className="text-dark-200">
            Create a strong and secure password
          </p>
        </div>

        <Card className="bg-dark-800 border-dark-700">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg mb-6"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationErrors({});
                }}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
              />
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.password}</p>
              )}
              <p className="mt-1 text-xs text-dark-300">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </p>
            </div>

            <div>
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationErrors({});
                }}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
              />
              {validationErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.confirmPassword}</p>
              )}
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              size="lg" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700 text-center">
            <Link to="/login" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
              ← Back to Login
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
