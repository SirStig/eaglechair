import { api, IS_DEMO_MODE } from '../config/apiClient';
import { demoUser, demoAdminUser } from '../data/demoData';

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
    if (IS_DEMO_MODE) {
      // Demo mode - simulate login
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      
      const isAdmin = credentials.email.toLowerCase().includes('admin');
      const user = isAdmin ? demoAdminUser : demoUser;
      
      return {
        user,
        access_token: 'demo-token-' + Date.now(),
      };
    }
    
    return await api.post('/api/v1/auth/login', credentials);
  },

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} User data and token
   */
  register: async (userData) => {
    if (IS_DEMO_MODE) {
      // Demo mode - simulate registration
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newUser = {
        id: Date.now(),
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        company: userData.company,
        role: 'user',
      };
      
      return {
        user: newUser,
        access_token: 'demo-token-' + Date.now(),
      };
    }
    
    return await api.post('/api/v1/auth/register', userData);
  },

  /**
   * Get current user profile
   * @returns {Promise<Object>} User data
   */
  getCurrentUser: async () => {
    if (IS_DEMO_MODE) {
      const token = localStorage.getItem('auth-token');
      if (token && token.includes('admin')) {
        return demoAdminUser;
      }
      return demoUser;
    }
    
    return await api.get('/api/v1/auth/me');
  },

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  logout: async () => {
    if (IS_DEMO_MODE) {
      localStorage.removeItem('auth-token');
      return;
    }
    
    return await api.post('/api/v1/auth/logout');
  },
};

export default authService;

