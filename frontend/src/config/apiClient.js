import axios from 'axios';
import logger from '../utils/logger';

const CONTEXT = 'APIClient';

// Get configuration from environment variables
// CRITICAL: No fallback to localhost - must be set in .env files
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Log configuration at startup
logger.info(CONTEXT, `API Client Configuration:`, {
  baseURL: API_BASE_URL || '(using relative URLs)',
  demoMode: IS_DEMO_MODE,
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

// Helper to check if token is expired or about to expire (within 5 minutes)
const isTokenExpiredOrExpiringSoon = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return Date.now() >= exp || fiveMinutesFromNow >= exp;
  } catch (error) {
    return true;
  }
};

// Request interceptor - Add auth token and proactively refresh if needed
apiClient.interceptors.request.use(
  async (config) => {
    // Skip proactive refresh for login/refresh endpoints
    if (config.url?.includes('/auth/login') || 
        config.url?.includes('/auth/refresh') ||
        config.url?.includes('/auth/admin/login')) {
      return config;
    }

    // Get auth data from Zustand persist storage
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        const token = state?.token;
        
        // Proactively refresh token if expired or expiring soon
        if (token && isTokenExpiredOrExpiringSoon(token) && state?.refreshToken && !isRefreshing) {
          const refreshToken = state.refreshToken;
          
          try {
            isRefreshing = true;
            const refreshResponse = await axios.post(
              `${API_BASE_URL}/api/v1/auth/refresh`,
              {},
              {
                headers: {
                  'Authorization': `Bearer ${refreshToken}`
                }
              }
            );

            const { access_token, refresh_token } = refreshResponse.data;
            
            // Update auth storage
            const updatedState = {
              ...state,
              token: access_token,
              refreshToken: refresh_token || refreshToken
            };
            localStorage.setItem('auth-storage', JSON.stringify({ state: updatedState }));
            
            // Update config with new token
            config.headers.Authorization = `Bearer ${access_token}`;
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            isRefreshing = false;
          } catch (refreshError) {
            isRefreshing = false;
            // If refresh fails, continue with original token - will be caught by response interceptor
            logger.warn(CONTEXT, 'Proactive token refresh failed', refreshError);
          }
        } else if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add admin tokens if present
        if (state?.sessionToken) {
          config.headers['X-Session-Token'] = state.sessionToken;
        }
        if (state?.adminToken) {
          config.headers['X-Admin-Token'] = state.adminToken;
        }
      } catch (e) {
        logger.error(CONTEXT, 'Error parsing auth storage', e);
      }
    }
    
    logger.debug(CONTEXT, `${config.method?.toUpperCase()} ${config.url}`, {
      hasAuth: !!config.headers.Authorization,
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
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor - Normalized error handling with token refresh
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
        return handleAuthError(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      // Try to refresh token
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token from auth store
        const authStorage = localStorage.getItem('auth-storage');
        if (!authStorage) {
          throw new Error('No auth storage found');
        }

        const { state } = JSON.parse(authStorage);
        const refreshToken = state?.refreshToken;

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint - use raw axios to bypass our response interceptor
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${refreshToken}`
            }
          }
        );

        const { access_token, refresh_token } = refreshResponse.data;
        
        // Update auth storage
        const updatedState = {
          ...state,
          token: access_token,
          refreshToken: refresh_token || refreshToken
        };
        localStorage.setItem('auth-storage', JSON.stringify({ state: updatedState }));
        
        // Update apiClient headers
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        // Process queued requests
        processQueue(null, access_token);
        isRefreshing = false;
        
        // Retry original request with new token
        originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Refresh failed - logout user
        return handleAuthError(error);
      }
    }

    // Handle other errors
    return handleNonAuthError(error);
  }
);

// Helper to handle authentication errors
function handleAuthError(error) {
  // Import authStore dynamically to avoid circular dependency
  import('../store/authStore').then(({ useAuthStore }) => {
    useAuthStore.getState().logout();
  }).catch(() => {
    // Fallback if import fails
    localStorage.removeItem('auth-storage');
  });

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
    
    switch (error.response.status) {
      case 400:
        normalizedError.message = error.response.data?.message || 'Bad request';
        break;
      case 403:
        normalizedError.message = 'Access forbidden';
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

