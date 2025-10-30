/**
 * Global Axios Configuration
 * Sets up axios defaults to use the API base URL from environment variables
 * This ensures ALL axios calls (even when importing axios directly) use the correct base URL
 */
import axios from 'axios';
import logger from '../utils/logger';

const CONTEXT = 'AxiosConfig';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;

// Log configuration
logger.info(CONTEXT, 'Configuring global axios defaults:', {
  baseURL: API_BASE_URL || '(using relative URLs)',
  timeout: API_TIMEOUT,
  mode: import.meta.env.MODE,
});

// Validate production configuration
if (import.meta.env.PROD && !API_BASE_URL) {
  logger.warn(CONTEXT, 'WARNING: VITE_API_BASE_URL not set in production build!');
}

// Configure axios defaults globally
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = API_TIMEOUT;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor to log all requests in development
if (import.meta.env.DEV) {
  axios.interceptors.request.use(
    (config) => {
      logger.debug(CONTEXT, `${config.method?.toUpperCase()} ${config.url}`, {
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
      });
      return config;
    },
    (error) => {
      logger.error(CONTEXT, 'Request error:', error);
      return Promise.reject(error);
    }
  );
}

export default axios;
