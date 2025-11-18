import { api } from '../config/apiClient';

/**
 * Authentication Service
 * Handles login, registration, and auth-related API calls
 */

export const authService = {
  /**
   * Login user
   * @param {Object} credentials - Email and password
   * @returns {Promise<Object>} User data and token
   */
  login: async (credentials) => {
    return await api.post('/api/v1/auth/login', credentials);
  },

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} User data and token
   */
  register: async (userData) => {
    return await api.post('/api/v1/auth/register', userData);
  },

  /**
   * Get current user profile
   * @returns {Promise<Object>} User data
   */
  getCurrentUser: async () => {
    return await api.get('/api/v1/auth/me');
  },

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  logout: async () => {
    return await api.post('/api/v1/auth/logout');
  },

  /**
   * Verify email address
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Verification result
   */
  verifyEmail: async (token) => {
    return await api.post('/api/v1/auth/verify-email', { token });
  },

  /**
   * Resend verification email
   * @param {string} email - Email address
   * @returns {Promise<Object>} Resend result
   */
  resendVerification: async (email) => {
    return await api.post('/api/v1/auth/resend-verification', { email });
  },
};

export default authService;

