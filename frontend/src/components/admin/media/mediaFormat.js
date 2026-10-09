export const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

/** Seconds since epoch (file mtime) or an ISO string (UTC when it has no zone) -> "Oct 9, 2026" */
export const formatDate = (value, withTime = false) => {
  if (!value) return '';
  const date = typeof value === 'number'
    ? new Date(value * 1000)
    : new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`);
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};

export const usageSummary = (usedBy = []) => {
  if (!usedBy.length) return 'Not used';
  const first = `${usedBy[0].type}: ${usedBy[0].label}`;
  return usedBy.length > 1 ? `${first} +${usedBy.length - 1}` : first;
};

/** Like errorMessage, for requests made with responseType 'blob' (the error body is a Blob). */
export async function errorText(err, fallback) {
  const data = err?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.message || body.detail || fallback;
    } catch {
      return fallback;
    }
  }
  return errorMessage(err, fallback);
}

export const errorMessage = (err, fallback) => err?.data?.message || err?.data?.detail || err?.message || fallback;

/** Images the built-in editor can open */
export const isEditableImage = (url = '') => /\.(jpe?g|png|webp)$/i.test(url.split('?')[0]);

export const DOC_KIND_LABELS = {
  pdf: 'PDF',
  word: 'Word',
  zip: 'ZIP',
  cad: 'CAD',
  spreadsheet: 'Spreadsheet',
  other: 'Other',
};
