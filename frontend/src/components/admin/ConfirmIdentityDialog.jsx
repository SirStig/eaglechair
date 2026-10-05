import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, KeyRound, ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import apiClient from '../../config/apiClient';
import { registerIdentityConfirmationHandler } from '../../services/identityConfirmation';
import { getPasskey, isPasskeySupported } from '../../utils/passkey';

const CONFIRM_URL = '/api/v1/auth/admin/confirm';

const errorText = (error, fallback) =>
  error?.data?.message || error?.data?.detail || error?.message || fallback;

/**
 * "Confirm it's you" prompt for dangerous admin actions. Mounted once in
 * AdminShell; opened by apiClient through services/identityConfirmation.js.
 */
export default function ConfirmIdentityDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // { hasPasskey, hasMfa }
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resolveRef = useRef(null);

  const finish = useCallback((confirmed) => {
    setOpen(false);
    setPassword('');
    setCode('');
    setError('');
    setBusy(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    if (resolve) resolve(confirmed);
  }, []);

  useEffect(() => registerIdentityConfirmationHandler((resolve) => {
    resolveRef.current = resolve;
    setStatus(null);
    setError('');
    setOpen(true);
    apiClient.get(CONFIRM_URL)
      .then(setStatus)
      .catch(() => setStatus({ hasPasskey: false, hasMfa: false }));
  }), []);

  const confirmWithPasskey = async () => {
    setBusy(true);
    setError('');
    try {
      const { challengeId, ...publicKeyOptions } = await apiClient.post(`${CONFIRM_URL}/options`, {});
      const credential = await getPasskey(publicKeyOptions);
      if (!credential) {
        setError('Passkey check was cancelled');
        setBusy(false);
        return;
      }
      await apiClient.post(CONFIRM_URL, { passkey: { challengeId, credential } });
      finish(true);
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Passkey check was cancelled' : errorText(err, 'Passkey could not be verified'));
      setBusy(false);
    }
  };

  const confirmWithPassword = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(CONFIRM_URL, {
        password,
        two_factor_code: status?.hasMfa ? code.trim() : undefined,
      });
      finish(true);
    } catch (err) {
      setError(errorText(err, 'Could not confirm your identity'));
      setBusy(false);
    }
  };

  const showPasskey = status?.hasPasskey && isPasskeySupported();

  return (
    <Modal isOpen={open} onClose={() => !busy && finish(false)} size="sm" closeOnOverlayClick={!busy}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-primary-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-dark-50">Confirm it&apos;s you</h3>
            <p className="text-sm text-dark-300">
              Adding or changing admins and permanent deletes need a quick re-check. It stays valid for 5 minutes.
            </p>
          </div>
        </div>

        {!status ? (
          <p className="py-6 text-center text-sm text-dark-300">Checking sign-in options…</p>
        ) : (
          <>
            {showPasskey && (
              <>
                <Button className="w-full" onClick={confirmWithPasskey} disabled={busy}>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  {busy ? 'Waiting for passkey…' : 'Use passkey'}
                </Button>
                <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-dark-400">
                  <span className="h-px flex-1 bg-dark-600" />
                  or use your password
                  <span className="h-px flex-1 bg-dark-600" />
                </div>
              </>
            )}

            <form onSubmit={confirmWithPassword} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-dark-200">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={!showPasskey}
                  className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-dark-50 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </label>
              {status.hasMfa && (
                <label className="block">
                  <span className="mb-1 block text-sm text-dark-200">Authenticator code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                    className="w-full rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 tracking-widest text-dark-50 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </label>
              )}

              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => finish(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={showPasskey ? 'outline' : 'primary'}
                  disabled={busy || !password || (status.hasMfa && !code.trim())}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Confirm
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
