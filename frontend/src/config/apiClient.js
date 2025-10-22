import axios from 'axios';
import logger from '../utils/logger';

const CONTEXT = 'APIClient';

// Get configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

logger.info(CONTEXT, `Initializing API client - Base URL: ${API_BASE_URL}, Demo Mode: ${IS_DEMO_MODE}`);

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token if available
apiClient.interceptors.request.use(
  (config) => {
    // Get auth data from Zustand persist storage
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
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

// Response interceptor - Normalized error handling
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const normalizedError = {
      message: 'An error occurred',
      status: null,
      data: null,
    };

    if (error.response) {
      // Server responded with error status
      normalizedError.status = error.response.status;
      normalizedError.data = error.response.data;
      
      switch (error.response.status) {
        case 400:
          normalizedError.message = error.response.data?.message || 'Bad request';
          break;
        case 401:
          normalizedError.message = 'Unauthorized - Please login';
          // Clear auth token
          localStorage.removeItem('auth-token');
          // Redirect to login if needed
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
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
      // Request made but no response
      normalizedError.message = 'Network error - Please check your connection';
    } else {
      // Error in request setup
      normalizedError.message = error.message || 'An error occurred';
    }

    logger.error(CONTEXT, `API Error: ${normalizedError.message}`, {
      status: normalizedError.status,
      data: normalizedError.data,
      url: error.config?.url
    });
    return Promise.reject(normalizedError);
  }
);

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

