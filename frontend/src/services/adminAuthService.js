import apiClient from '../config/apiClient';

// Returns WebAuthn options plus a server-issued, single-use `challengeId`
export async function getPasskeyAuthOptions(username) {
  return apiClient.post('/api/v1/auth/admin/passkey/options', { username });
}

// payload: { challengeId, credential }
export async function authenticateWithPasskey(payload) {
  return apiClient.post('/api/v1/auth/admin/passkey/authenticate', payload);
}

export async function getPasskeyRegisterOptions() {
  return apiClient.post('/api/v1/auth/admin/passkey/register/options');
}

// payload: { challengeId, credential }
export async function registerPasskey(credential) {
  return apiClient.post('/api/v1/auth/admin/passkey/register', credential);
}

export async function getMfaSetupOptions() {
  return apiClient.get('/api/v1/auth/admin/mfa/setup');
}

export async function enableMfa(code) {
  return apiClient.post('/api/v1/auth/admin/mfa/setup', { code });
}

export async function getSetupStatus() {
  return apiClient.get('/api/v1/auth/admin/setup-status');
}
