/* global __BUILD_TIMESTAMP__ */
import axios from 'axios';
import logger from '../utils/logger';
import { notifyAdminWrite } from '../utils/cmsContentStore';
import { isReauthRequired, requestIdentityConfirmation } from '../services/identityConfirmation';

const CONTEXT = 'APIClient';

// Get configuration from environment variables
// CRITICAL: No fallback to localhost - must be set in .env files
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;
// Demo mode removed - always use API
export const IS_DEMO_MODE = false;

// Log configuration at startup
logger.info(CONTEXT, `API Client Configuration:`, {
  baseURL: API_BASE_URL || '(using relative URLs)',
  mode: import.meta.env.MODE,
  buildTimestamp: typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'unknown'
});

// Validate production configuration
if (import.meta.env.PROD && !API_BASE_URL) {
  logger.warn(CONTEXT, 'WARNING: VITE_API_BASE_URL not set in production build. Using relative URLs.');
}

// Create axios instance with base configuration
// Authentication uses httpOnly cookies set by the backend (access_token,
// refresh_token, and for admins session_token/admin_token). withCredentials
// makes the browser send them; tokens are never readable from JS.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  withCredentials: true,
});

// Token keys used by older builds that kept credentials in Web Storage
const LEGACY_TOKEN_KEYS = [
  'auth_access_token',
  'auth_refresh_token',
  'auth_session_token',
  'auth_admin_token',
];

/**
 * Remove any auth tokens left in localStorage/sessionStorage by older builds.
 * Safe to call at any time (e.g. on app start).
 */
export const purgeStoredTokens = () => {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      LEGACY_TOKEN_KEYS.forEach((key) => storage?.removeItem(key));
    } catch {
      // Storage may be unavailable (private mode / blocked) - nothing to clear
    }
  }
};

// Retry configuration for network errors
const isAbortedError = (error) => {
  return error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    /aborted|NS_BINDING/i.test(error?.message || '');
};

const getRetryConfig = (config) => {
  return {
    retries: config.retry !== undefined ? config.retry : 3,
    retryDelay: config.retryDelay || ((retryCount) => Math.min(1000 * 2 ** retryCount, 30000)),
    retryCondition: config.retryCondition || ((error) => {
      if (isAbortedError(error)) return false;
      return !error.response || (error.response.status >= 500 && error.response.status < 600);
    })
  };
};

// Request interceptor
// Auth is carried by httpOnly cookies (withCredentials) - no token headers
apiClient.interceptors.request.use(
  async (config) => {
    // Initialize retry config if not set
    if (config.retry === undefined) {
      const retryConfig = getRetryConfig(config);
      config.retry = retryConfig.retries;
      config.retryDelay = retryConfig.retryDelay;
      config.retryCondition = retryConfig.retryCondition;
      config._retryCount = config._retryCount || 0;
    }
    
    logger.debug(CONTEXT, `${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params
    });
    return config;
  },
  (error) => {
    logger.error(CONTEXT, 'Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Token refresh state
let isRefreshing = false;
let refreshPromise = null;
let failedQueue = [];

// Process queued requests after token refresh
const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
};

// Response interceptor - Normalized error handling with token refresh
// Refresh uses the httpOnly refresh_token cookie; the backend sets new cookies
apiClient.interceptors.response.use(
  (response) => {
    // Admin/CMS writes invalidate the public content caches in one place
    try {
      notifyAdminWrite(response.config, response.data);
    } catch (err) {
      logger.warn(CONTEXT, 'Content invalidation after write failed', err);
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Dangerous admin writes need a fresh passkey/password confirmation:
    // prompt once, then retry the request (services/identityConfirmation.js)
    if (originalRequest && !originalRequest._reauthRetry && isReauthRequired(error)) {
      originalRequest._reauthRetry = true;
      if (await requestIdentityConfirmation()) {
        return apiClient(originalRequest);
      }
      return handleNonAuthError(error);
    }

    // Wrong password while confirming identity / changing password: a 401
    // here is not an expired session, so don't refresh or sign out
    if (
      error.response?.status === 401 &&
      (originalRequest?.url?.includes('/auth/admin/confirm') ||
        originalRequest?.url?.includes('/auth/password/change'))
    ) {
      return handleNonAuthError(error);
    }

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for login/refresh endpoints
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/admin/login') ||
          originalRequest.url?.includes('/auth/admin/passkey/')) {
        return handleAuthError(error); // already a rejected promise with the normalized error
      }

      // If already refreshing, queue this request
      if (isRefreshing && refreshPromise) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          // Retry original request - the refreshed cookies are sent automatically
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      // Try to refresh using the httpOnly refresh_token cookie
      originalRequest._retry = true;
      isRefreshing = true;

      refreshPromise = (async () => {
        try {
          // Backend reads the refresh_token cookie and sets new auth cookies
          await apiClient.post('/api/v1/auth/refresh', {});

          // Process queued requests
          processQueue(null);
        } catch (refreshError) {
          // Process queued requests with error
          processQueue(refreshError);
          throw refreshError;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      try {
        await refreshPromise;

        // Retry original request - new cookies are sent automatically
        return apiClient(originalRequest);
      } catch {
        // Refresh failed - clear auth state
        return handleAuthError(error); // already a rejected promise with the normalized error
      }
    }

    // Handle retry logic for network errors and 5xx errors
    // Reuse originalRequest from above (line 116)
    if (originalRequest && originalRequest.retry && originalRequest.retryCondition) {
      const retryCount = originalRequest._retryCount || 0;
      
      if (retryCount < originalRequest.retry && originalRequest.retryCondition(error)) {
        originalRequest._retryCount = retryCount + 1;
        const delay = originalRequest.retryDelay(retryCount);
        
        logger.debug(CONTEXT, `Retrying request (attempt ${retryCount + 1}/${originalRequest.retry}) after ${delay}ms`, {
          url: originalRequest.url
        });
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(apiClient(originalRequest));
          }, delay);
        });
      }
    }

    // Handle other errors
    return handleNonAuthError(error); // already a rejected promise with the normalized error
  }
);

// Helper to handle authentication errors
function handleAuthError(error) {
  // Use dynamic import to avoid circular dependency, but handle it properly
  // Note: This is only used in error path, so it won't affect bundle splitting
  if (typeof window !== 'undefined') {
    import('../store/authStore').then(({ useAuthStore }) => {
      // Clear auth state without calling logout() to avoid redirect loops
      // ProtectedRoute will handle redirects naturally
      useAuthStore.setState({
        user: null,
        isAuthenticated: false
      });
      // Clear cached profile (and any legacy tokens) from storage
      purgeStoredTokens();
      try {
        localStorage.removeItem('auth_user');
      } catch {
        // Storage unavailable
      }
    }).catch(() => {
      // Fallback if import fails - clear storage manually
      purgeStoredTokens();
      try {
        localStorage.removeItem('auth_user');
      } catch {
        // Storage unavailable
      }
      logger.warn(CONTEXT, 'Failed to import authStore for logout');
    });
  }

  const normalizedError = {
    message: 'Unauthorized - Please login',
    status: 401,
    data: error.response?.data || null,
  };

  // Don't redirect here - let React Router and ProtectedRoute handle redirects
  // This prevents full page reloads and infinite loops

  return Promise.reject(normalizedError);
}

// Helper to handle non-authentication errors
function handleNonAuthError(error) {
  const normalizedError = {
    message: 'An error occurred',
    status: null,
    data: null,
  };

  if (error.response) {
    normalizedError.status = error.response.status;
    normalizedError.data = error.response.data;
    
    // Preserve original message for ACCOUNT_NOT_VERIFIED (email verification)
    const errorCode = error.response.data?.error || error.response.data?.error_code || '';
    const isVerificationError = errorCode === 'ACCOUNT_NOT_VERIFIED';
    
    switch (error.response.status) {
      case 400:
        normalizedError.message = error.response.data?.message || 'Bad request';
        break;
      case 403:
        // Server messages are human readable (verification, missing
        // permissions such as "This action requires Delete permissions.")
        normalizedError.message = error.response.data?.message
          || (isVerificationError ? 'Account not verified' : 'Access forbidden');
        break;
      case 401:
        normalizedError.message = error.response.data?.message || 'Unauthorized';
        break;
      case 404:
        normalizedError.message = 'Resource not found';
        break;
      case 422:
        normalizedError.message = error.response.data?.message || 'Validation error';
        break;
      case 500:
        normalizedError.message = 'Server error - Please try again later';
        break;
      default:
        normalizedError.message = error.response.data?.message || 'An error occurred';
    }
  } else if (error.request) {
    normalizedError.message = 'Network error - Please check your connection';
  } else {
    normalizedError.message = error.message || 'An error occurred';
  }

  logger.error(CONTEXT, `API Error: ${normalizedError.message}`, {
    status: normalizedError.status,
    data: normalizedError.data,
    url: error.config?.url
  });
  return Promise.reject(normalizedError);
}

// API wrapper functions
export const api = {
  // GET request
  get: async (url, config = {}) => {
    return apiClient.get(url, config);
  },

  // POST request
  post: async (url, data = {}, config = {}) => {
    return apiClient.post(url, data, config);
  },

  // PUT request
  put: async (url, data = {}, config = {}) => {
    return apiClient.put(url, data, config);
  },

  // PATCH request
  patch: async (url, data = {}, config = {}) => {
    return apiClient.patch(url, data, config);
  },

  // DELETE request
  delete: async (url, config = {}) => {
    return apiClient.delete(url, config);
  },

  // Upload file(s) with FormData
  upload: async (url, formData, onUploadProgress = null) => {
    return apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percentCompleted);
      } : undefined,
    });
  },
};

export default apiClient;

