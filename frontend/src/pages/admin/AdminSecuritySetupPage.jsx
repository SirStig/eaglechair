import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import {
  getSetupStatus,
  getPasskeyRegisterOptions,
  registerPasskey,
  getMfaSetupOptions,
  enableMfa,
} from '../../services/adminAuthService';
import { createPasskey, isPasskeySupported } from '../../utils/passkey';

const AdminSecuritySetupPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaSecret, setMfaSecret] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState(null);
  const [passkeyDone, setPasskeyDone] = useState(false);
  const [mfaDone, setMfaDone] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.type !== 'admin') {
      navigate('/login', { state: { from: { pathname: '/admin/setup-security' } } });
      return;
    }
    getSetupStatus()
      .then(setStatus)
      .catch(() => setError('Failed to load setup status'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (status?.needsPasskey === false) setPasskeyDone(true);
    if (status?.needsMfa === false) setMfaDone(true);
  }, [status]);

  const handlePasskeyRegister = async () => {
    setError(null);
    try {
      const options = await getPasskeyRegisterOptions();
      const credential = await createPasskey(options);
      if (!credential) {
        setError('Passkey registration was cancelled');
        return;
      }
      await registerPasskey({ options, credential });
      setPasskeyDone(true);
      if (!status?.needsMfa) navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Passkey registration failed');
    }
  };

  const handleMfaStart = async () => {
    setError(null);
    try {
      const data = await getMfaSetupOptions();
      if (data.enabled) {
        setMfaDone(true);
        if (!status?.needsPasskey) navigate('/admin/dashboard', { replace: true });
        return;
      }
      setMfaSecret(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to get MFA options');
    }
  };

  const handleMfaVerify = async (e) => {
    e?.preventDefault();
    if (!mfaCode || mfaCode.length < 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setError(null);
    try {
      await enableMfa(mfaCode);
      setMfaDone(true);
      setMfaCode('');
      if (!status?.needsPasskey || passkeyDone) navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid code');
    }
  };

  const handleSkip = () => {
    navigate('/admin/dashboard', { replace: true });
  };

  if (loading || !status) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-pulse text-dark-300">Loading...</div>
      </div>
    );
  }

  if (!status.requiresSetup) {
    navigate('/admin/dashboard', { replace: true });
    return null;
  }

  const showPasskey = status.needsPasskey;
  const showMfa = status.needsMfa;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-dark-50 mb-2 text-center">Security Setup Required</h2>
        <p className="text-dark-200 text-center mb-8">
          Set up both passkey and two-factor authentication for stronger security and longer sessions.
        </p>

        <Card className="bg-dark-800 border-dark-700 space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-600 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {showPasskey && (
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2">
                {passkeyDone ? '✓ Passkey' : '1. Add Passkey'}
              </h3>
              {passkeyDone ? (
                <p className="text-dark-200">Passkey is set up.</p>
              ) : isPasskeySupported() ? (
                <Button onClick={handlePasskeyRegister} variant="primary" className="w-full">
                  Register Passkey
                </Button>
              ) : (
                <p className="text-dark-300 text-sm">Passkeys are not supported in this browser. Set up MFA instead.</p>
              )}
            </div>
          )}

          {showMfa && (
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2">
                {mfaDone ? '✓ Two-Factor Authentication' : '2. Two-Factor Authentication'}
              </h3>
              {mfaDone ? (
                <p className="text-dark-200">2FA is enabled.</p>
              ) : mfaSecret ? (
                <form onSubmit={handleMfaVerify} className="space-y-4">
                  <p className="text-dark-200 text-sm">
                    Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code.
                  </p>
                  {mfaSecret.provisioningUri && (
                    <div className="flex justify-center py-4">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSecret.provisioningUri)}`}
                        alt="QR Code"
                        className="rounded"
                      />
                    </div>
                  )}
                  <Input
                    label="Verification code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button type="submit" variant="primary" className="w-full">
                    Verify and Enable
                  </Button>
                </form>
              ) : (
                <Button onClick={handleMfaStart} variant="primary" className="w-full">
                  Set Up Authenticator App
                </Button>
              )}
            </div>
          )}

          {(showPasskey || showMfa) && (
            <Button onClick={handleSkip} variant="secondary" className="w-full mt-4">
              Skip for now
            </Button>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminSecuritySetupPage;
