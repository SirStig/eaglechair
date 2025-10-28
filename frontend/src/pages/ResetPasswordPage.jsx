import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const ResetPasswordPage = () => {
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
      <div className="min-h-screen bg-dark-800 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="mb-4 text-red-500">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-dark-50">Invalid Reset Link</h2>
          <p className="text-dark-100 mb-6">
            This password reset link is invalid or has expired. Reset links are only valid for 1 hour.
          </p>
          <Link to="/forgot-password">
            <Button variant="primary" className="w-full mb-3">
              Request New Link
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              Back to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-2 text-dark-50">Set New Password</h2>
        <p className="text-dark-100 mb-6">
          Enter your new password below. Make sure it's strong and secure.
        </p>

        {error && (
          <div className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
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
              className="w-full"
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
              className="w-full"
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

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
