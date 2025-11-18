import axios from 'axios';
import logger from '../utils/logger';

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
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  // Don't set default Content-Type - let axios auto-detect based on request data
});

// Request interceptor
// Tokens are stored in localStorage and sent via Authorization header
apiClient.interceptors.request.use(
  async (config) => {
    // Get access token from localStorage and add to Authorization header
    const accessToken = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_access_token') 
      : null;
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // For admin users, also send session_token and admin_token headers
    const sessionToken = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_session_token') 
      : null;
    const adminToken = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_admin_token') 
      : null;
    
    if (sessionToken) {
      config.headers['X-Session-Token'] = sessionToken;
    }
    if (adminToken) {
      config.headers['X-Admin-Token'] = adminToken;
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

// Response interceptor - Normalized error handling with token refresh
// Tokens are stored in localStorage and sent via Authorization headers
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for login/refresh endpoints
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/admin/login')) {
        return Promise.reject(handleAuthError(error));
      }

      // If already refreshing, wait for it to complete
      if (isRefreshing) {
        // Wait for refresh to complete and retry
        return new Promise((resolve, reject) => {
          const checkRefresh = setInterval(() => {
            if (!isRefreshing) {
              clearInterval(checkRefresh);
              // Retry original request with new token
              apiClient(originalRequest).then(resolve).catch(reject);
            }
          }, 100);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkRefresh);
            reject(handleAuthError(error));
          }, 5000);
        });
      }

      // Try to refresh token using refresh_token from localStorage
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token from localStorage
        const refreshToken = typeof window !== 'undefined' 
          ? localStorage.getItem('auth_refresh_token') 
          : null;
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Refresh token - send refresh_token via Authorization header
        const refreshResponse = await apiClient.post('/api/v1/auth/refresh', {}, {
          headers: {
            Authorization: `Bearer ${refreshToken}`
          }
        });
        
                    // Update tokens in localStorage
                    if (refreshResponse.access_token) {
                      localStorage.setItem('auth_access_token', refreshResponse.access_token);
                    }
                    if (refreshResponse.refresh_token) {
                      localStorage.setItem('auth_refresh_token', refreshResponse.refresh_token);
                    }
                    // Note: Admin tokens (session_token, admin_token) are NOT refreshed
                    // They persist from login until logout - keep existing ones in localStorage
                    
                    isRefreshing = false;
                    
                    // Retry original request with new access token
                    originalRequest.headers.Authorization = `Bearer ${refreshResponse.access_token}`;
                    // Preserve admin headers if they exist in localStorage
                    const sessionToken = typeof window !== 'undefined' 
                      ? localStorage.getItem('auth_session_token') 
                      : null;
                    const adminToken = typeof window !== 'undefined' 
                      ? localStorage.getItem('auth_admin_token') 
                      : null;
                    if (sessionToken) {
                      originalRequest.headers['X-Session-Token'] = sessionToken;
                    }
                    if (adminToken) {
                      originalRequest.headers['X-Admin-Token'] = adminToken;
                    }
                    return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        
        // Refresh failed - logout user
        return Promise.reject(handleAuthError(error));
      }
    }

    // Handle other errors
    return Promise.reject(handleNonAuthError(error));
  }
);

// Helper to handle authentication errors
function handleAuthError(error) {
  // Use dynamic import to avoid circular dependency, but handle it properly
  // Note: This is only used in error path, so it won't affect bundle splitting
  if (typeof window !== 'undefined') {
    import('../store/authStore').then(({ useAuthStore }) => {
      useAuthStore.getState().logout();
    }).catch(() => {
      // Fallback if import fails - clear localStorage manually
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_session_token');
      localStorage.removeItem('auth_admin_token');
      localStorage.removeItem('auth_user');
      logger.warn(CONTEXT, 'Failed to import authStore for logout');
    });
  }

  const normalizedError = {
    message: 'Unauthorized - Please login',
    status: 401,
    data: error.response?.data || null,
  };

  // Only redirect if not already on login page
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }

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
        // Preserve original message for verification errors, otherwise generic message
        if (isVerificationError && error.response.data?.message) {
          normalizedError.message = error.response.data.message;
        } else {
          normalizedError.message = 'Access forbidden';
        }
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
    try {
      return await apiClient.get(url, config);
    } catch (error) {
      throw error;
    }
  },

  // POST request
  post: async (url, data = {}, config = {}) => {
    try {
      return await apiClient.post(url, data, config);
    } catch (error) {
      throw error;
    }
  },

  // PUT request
  put: async (url, data = {}, config = {}) => {
    try {
      return await apiClient.put(url, data, config);
    } catch (error) {
      throw error;
    }
  },

  // PATCH request
  patch: async (url, data = {}, config = {}) => {
    try {
      return await apiClient.patch(url, data, config);
    } catch (error) {
      throw error;
    }
  },

  // DELETE request
  delete: async (url, config = {}) => {
    try {
      return await apiClient.delete(url, config);
    } catch (error) {
      throw error;
    }
  },

  // Upload file(s) with FormData
  upload: async (url, formData, onUploadProgress = null) => {
    try {
      return await apiClient.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onUploadProgress ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        } : undefined,
      });
    } catch (error) {
      throw error;
    }
  },
};

export default apiClient;

