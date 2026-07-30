/**
 * localStorage.setItem can throw in Safari private browsing (QuotaExceededError)
 * even when the underlying operation (e.g. a successful login) already succeeded.
 * This wrapper prevents that from surfacing as an unrelated failure.
 */
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to write to localStorage (key: ${key}):`, error);
    return false;
  }
};
