/**
 * Step-up identity confirmation (backend/services/admin_confirmation.py).
 *
 * Dangerous admin writes answer 403 REAUTH_REQUIRED until the admin has
 * re-confirmed with a passkey or password in the last 5 minutes. apiClient
 * calls requestIdentityConfirmation() on that error, which opens
 * <ConfirmIdentityDialog> (mounted once in AdminShell) and resolves true
 * once confirmed, false if cancelled. Concurrent requests share one prompt.
 */

let listener = null;
let pending = null;

/** The dialog registers itself here; returns an unsubscribe function */
export function registerIdentityConfirmationHandler(handler) {
  listener = handler;
  return () => {
    if (listener === handler) listener = null;
  };
}

export function requestIdentityConfirmation() {
  if (!listener) return Promise.resolve(false);
  if (!pending) {
    pending = new Promise((resolve) => listener(resolve)).finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function isReauthRequired(error) {
  const data = error?.response?.data || error?.data;
  return (error?.response?.status === 403 || error?.status === 403) && data?.error === 'REAUTH_REQUIRED';
}
