import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await axios.post('/api/v1/auth/password/reset-request', {
        email: email
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="mb-4 text-green-500">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-dark-50">Check Your Email</h2>
          <p className="text-dark-100 mb-6">
            If an account exists with <strong>{email}</strong>, we've sent password reset instructions to that address.
          </p>
          <p className="text-sm text-dark-200 mb-6">
            Please check your email and click the link to reset your password. The link will expire in 1 hour.
          </p>
          <Link to="/login">
            <Button variant="primary" className="w-full">
              Return to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-2 text-dark-50">Reset Password</h2>
        <p className="text-dark-100 mb-6">
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        {error && (
          <div className="bg-red-900/30 border-2 border-red-600 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full"
          />

          <Button 
            type="submit" 
            variant="primary" 
            size="lg" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link to="/login" className="block text-sm text-primary-500 hover:text-primary-400 transition-colors">
            Back to Login
          </Link>
          <p className="text-xs text-dark-300">
            Don't have an account?{' '}
            <Link to="/login" className="text-primary-500 hover:text-primary-400">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
