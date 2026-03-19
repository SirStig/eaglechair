export async function createPasskey(options) {
  if (!window.PublicKeyCredential) {
    throw new Error('Passkeys are not supported in this browser');
  }
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64UrlToBuffer(options.user.id),
      },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({
        ...c,
        id: base64UrlToBuffer(c.id),
      })),
    },
  });
  if (!credential) return null;
  return credentialToJson(credential);
}

export async function getPasskey(options) {
  if (!window.PublicKeyCredential) {
    throw new Error('Passkeys are not supported in this browser');
  }
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((c) => ({
        ...c,
        id: base64UrlToBuffer(c.id),
      })),
    },
  });
  if (!credential) return null;
  return credentialToJson(credential);
}

function base64UrlToBuffer(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
  return buffer;
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function credentialToJson(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: response.attestationObject
        ? bufferToBase64Url(response.attestationObject)
        : undefined,
      authenticatorData: response.authenticatorData
        ? bufferToBase64Url(response.authenticatorData)
        : undefined,
      signature: response.signature ? bufferToBase64Url(response.signature) : undefined,
      userHandle: response.userHandle
        ? bufferToBase64Url(response.userHandle)
        : undefined,
    },
  };
}

export function isPasskeySupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}
