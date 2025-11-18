import axios from 'axios';

// Get API base URL from environment variables
// IMPORTANT: VITE_API_BASE_URL must be set in .env.production for production builds
// Dev: Uses Vite proxy to backend (relative URLs)
// Prod: Uses VITE_API_BASE_URL from .env.production (e.g., https://api.eaglechair.com)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Log configuration
if (import.meta.env.DEV) {
  console.log('[API Config] Using Vite proxy for development');
} else if (API_BASE_URL) {
  console.log(`[API Config] Using base URL: ${API_BASE_URL}`);
} else {
  console.warn('[API Config] No base URL set - using relative URLs');
}

// Create axios instance with default config
// Note: This file appears to be legacy - use apiClient.js instead
// Tokens are stored in localStorage and sent via Authorization headers
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor
// Tokens are stored in localStorage and sent via Authorization header
api.interceptors.request.use(
  (config) => {
    // Get access token from localStorage and add to Authorization header
    const accessToken = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_access_token') 
      : null;
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const { status } = error.response;
      
      if (status === 401) {
        // Unauthorized - tokens may be expired
        // Redirect to login if needed
        // window.location.href = '/login';
      } else if (status === 403) {
        console.error('Access forbidden');
      } else if (status === 404) {
        console.error('Resource not found');
      } else if (status >= 500) {
        console.error('Server error');
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network error - no response received');
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Products
  products: {
    list: '/api/v1/products',
    detail: (id) => `/api/v1/products/${id}`,
    create: '/api/v1/products',
    update: (id) => `/api/v1/products/${id}`,
    delete: (id) => `/api/v1/products/${id}`,
  },
  // Quotes
  quotes: {
    list: '/api/v1/quotes',
    detail: (id) => `/api/v1/quotes/${id}`,
    create: '/api/v1/quotes',
    update: (id) => `/api/v1/quotes/${id}`,
    delete: (id) => `/api/v1/quotes/${id}`,
  },
  // Company
  company: {
    info: '/api/v1/company',
    update: '/api/v1/company',
  },
};

export default api;

