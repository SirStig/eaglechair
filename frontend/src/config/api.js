import axios from 'axios';

// Get API base URL from environment variables
// In production on Dreamhost, frontend and backend are on same domain
// Dev: frontend (localhost:5173) -> backend (localhost:8000) via Vite proxy
// Prod: eaglechair.com/index.html -> eaglechair.com/api/... (same origin)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
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

