const HEX = '0123456789abcdef';
const FORM_PREFIX = 'echex1:';
const SAVE_METHODS = new Set(['post', 'put', 'patch']);
const encodedForms = new WeakSet();

function toHex(bytes) {
  const chunk = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    chunk[i] = HEX[bytes[i] >> 4] + HEX[bytes[i] & 15];
  }
  return chunk.join('');
}

export function encodeEnvelope(data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return { _ec: 1, body: toHex(new TextEncoder().encode(json)) };
}

export function isEnvelope(data) {
  let value = data;
  if (typeof data === 'string') {
    try {
      value = JSON.parse(data);
    } catch {
      return false;
    }
  }
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value)
    && value._ec === 1 && typeof value.body === 'string'
  );
}

export function encodeFormData(form) {
  if (encodedForms.has(form)) return form;
  const next = new FormData();
  for (const [key, entry] of form.entries()) {
    if (typeof entry === 'string') {
      next.append(key, FORM_PREFIX + toHex(new TextEncoder().encode(entry)));
    } else {
      next.append(key, entry, entry.name || 'upload');
    }
  }
  encodedForms.add(next);
  return next;
}

function isBinaryBody(data) {
  return (typeof Blob !== 'undefined' && data instanceof Blob)
    || (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer)
    || (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams);
}

/**
 * Pack a JSON or form write so the text is hex on the wire.
 * Files, reads, and bodies that are already packed are unchanged.
 */
export function prepareOutgoingBody(method, data) {
  const verb = (method || 'get').toLowerCase();
  if (data == null || !SAVE_METHODS.has(verb) || isBinaryBody(data) || isEnvelope(data)) {
    return data;
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return encodeFormData(data);
  }
  return encodeEnvelope(data);
}

export function prepareOutgoingConfig(config) {
  if (!config) return config;
  config.data = prepareOutgoingBody(config.method, config.data);
  return config;
}
