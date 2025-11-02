import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { useSiteSettings } from '../hooks/useContent';

const ForgotPasswordPage = () => {
  const { data: siteSettings } = useSiteSettings();
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
              className="mb-6 text-green-500"
            >
              <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-dark-50">Check Your Email</h2>
            <p className="text-dark-200 mb-6">
              If an account exists with <strong className="text-primary-500">{email}</strong>, we've sent password reset instructions to that address.
            </p>
            <p className="text-sm text-dark-300 mb-8">
              Please check your email and click the link to reset your password. The link will expire in 1 hour.
            </p>
            <Link to="/login">
              <Button variant="primary" size="lg" className="w-full">
                Return to Login
              </Button>
            </Link>
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
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-dark-50">Reset Password</h2>
          <p className="text-dark-200">
            Enter your email to receive reset instructions
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
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
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

          <div className="mt-6 pt-6 border-t border-dark-700 text-center space-y-3">
            <Link to="/login" className="block text-sm text-primary-500 hover:text-primary-400 transition-colors">
              ← Back to Login
            </Link>
            <p className="text-sm text-dark-300">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-500 hover:text-primary-400">
                Create Account
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
