import apiClient from '../config/apiClient';

export async function getPasskeyAuthOptions() {
  return apiClient.post('/api/v1/auth/admin/passkey/options');
}

export async function authenticateWithPasskey(credential) {
  return apiClient.post('/api/v1/auth/admin/passkey/authenticate', credential);
}

export async function getPasskeyRegisterOptions() {
  return apiClient.post('/api/v1/auth/admin/passkey/register/options');
}

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
