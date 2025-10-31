import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import apiClient from '../config/apiClient';
import { useSiteSettings } from '../hooks/useContent';

const EmailVerificationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { data: siteSettings } = useSiteSettings();
  
  const [verifying, setVerifying] = useState(!!token);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState(location.state?.email || '');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || null);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken) => {
    try {
      setVerifying(true);
      setError(null);
      const response = await apiClient.post('/api/v1/auth/verify-email', {
        token: verificationToken
      });
      
      setVerified(true);
      setTimeout(() => {
        navigate('/login', {
          state: {
            message: 'Email verified successfully! You can now log in.',
            type: 'success'
          }
        });
      }, 2000);
    } catch (err) {
      console.error('Verification error:', err);
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Verification failed. The link may have expired or is invalid.'
      );
      setVerifying(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setResending(true);
      setError(null);
      setResendSuccess(false);
      
      await apiClient.post('/api/v1/auth/resend-verification', {
        email: email
      });
      
      setResendSuccess(true);
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Resend error:', err);
      // Still show success for security (don't reveal if email exists)
      setResendSuccess(true);
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } finally {
      setResending(false);
    }
  };

  if (verifying && !error && !verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-dark-800 border-dark-700 text-center">
            <div className="py-12">
              <div className="w-16 h-16 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2 text-dark-50">Verifying Email...</h2>
              <p className="text-dark-200">Please wait while we verify your email address</p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-dark-800 border-dark-700 text-center">
            <div className="py-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-900/30 border-2 border-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h2 className="text-2xl font-bold mb-2 text-green-500">Email Verified!</h2>
              <p className="text-dark-200 mb-6">Your email address has been successfully verified.</p>
              <p className="text-sm text-dark-300">Redirecting to login...</p>
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
          <h2 className="text-3xl font-bold mb-2 text-dark-50">Verify Your Email</h2>
          <p className="text-dark-200">Enter your email to resend the verification link</p>
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
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">Verification Failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {resendSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-900/30 border-2 border-green-600 text-green-300 px-4 py-3 rounded-lg mb-6"
            >
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-semibold">Verification Email Sent</p>
                  <p className="text-sm mt-1">
                    If an account exists with this email and is not yet verified, you will receive a verification email shortly.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleResend} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button 
              type="submit" 
              variant="primary" 
              size="lg" 
              className="w-full"
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700 text-center space-y-4">
            <div className="text-sm text-dark-300">
              <p className="mb-2">Already verified?</p>
              <Link to="/login" className="text-primary-500 hover:text-primary-400 font-medium">
                Go to Login
              </Link>
            </div>
            
            <div className="text-sm text-dark-300">
              <p className="mb-2">Don't have an account?</p>
              <Link to="/register" className="text-primary-500 hover:text-primary-400 font-medium">
                Create Account
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default EmailVerificationPage;

