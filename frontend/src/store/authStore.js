import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../config/apiClient';
import logger from '../utils/logger';

const AUTH_CONTEXT = 'AuthStore';

// Helper function to decode JWT and check expiration
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true;
  }
};

// Helper function to validate user object
const isValidUser = (user) => {
  if (!user || typeof user !== 'object') return false;
  // Check for required fields
  return user.id && (user.email || user.username);
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      sessionToken: null,
      adminToken: null,
      isAuthenticated: false,

      login: async (credentials, cartStore = null) => {
        try {
          // Use configured API client with proper base URL
          // Note: apiClient response interceptor already returns response.data
          const data = await apiClient.post('/api/v1/auth/login', credentials);
          
          // Extract data from response
          const accessToken = data.access_token;
          const refreshToken = data.refresh_token;
          const user = data.user;
          const sessionToken = data.session_token;
          const adminToken = data.admin_token;
          
          // Validate user data
          if (!isValidUser(user)) {
            throw new Error('Invalid user data received from server');
          }
          
          set({ 
            user, 
            token: accessToken,
            refreshToken: refreshToken,
            sessionToken,
            adminToken,
            isAuthenticated: true 
          });
          
          // Set apiClient default headers
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Set admin tokens if present (for admin users)
          if (sessionToken) {
            apiClient.defaults.headers.common['X-Session-Token'] = sessionToken;
          }
          if (adminToken) {
            apiClient.defaults.headers.common['X-Admin-Token'] = adminToken;
          }
          
          // Merge guest cart if cartStore is provided
          if (cartStore && typeof cartStore.switchToAuthMode === 'function') {
            try {
              await cartStore.switchToAuthMode();
              logger.info(AUTH_CONTEXT, 'Guest cart merged on login');
            } catch (error) {
              logger.error(AUTH_CONTEXT, 'Error merging cart on login', error);
            }
          }
          
          return { success: true, user };
        } catch (error) {
          console.error('Login error:', error);
          // Clear any partial state
          get().logout();
          return { 
            success: false, 
            error: error.response?.data?.detail || error.message || 'Login failed' 
          };
        }
      },

      register: async (userData, cartStore = null) => {
        try {
          // Note: apiClient response interceptor already returns response.data
          const data = await apiClient.post('/api/v1/auth/register', userData);
          const { access_token, refresh_token, user } = data;
          
          // Validate user data
          if (!isValidUser(user)) {
            throw new Error('Invalid user data received from server');
          }
          
          set({ 
            user, 
            token: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true 
          });
          
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          
          // Merge guest cart if cartStore is provided
          if (cartStore && typeof cartStore.switchToAuthMode === 'function') {
            try {
              await cartStore.switchToAuthMode();
              logger.info(AUTH_CONTEXT, 'Guest cart merged on registration');
            } catch (error) {
              logger.error(AUTH_CONTEXT, 'Error merging cart on registration', error);
            }
          }
          
          return { success: true, user };
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Registration failed' 
          };
        }
      },

      logout: (cartStore = null) => {
        set({ 
          user: null, 
          token: null,
          refreshToken: null,
          sessionToken: null,
          adminToken: null,
          isAuthenticated: false 
        });
        delete apiClient.defaults.headers.common['Authorization'];
        delete apiClient.defaults.headers.common['X-Session-Token'];
        delete apiClient.defaults.headers.common['X-Admin-Token'];
        
        // Switch cart to guest mode if cartStore is provided
        if (cartStore && typeof cartStore.switchToGuestMode === 'function') {
          cartStore.switchToGuestMode();
          logger.info(AUTH_CONTEXT, 'Switched to guest cart on logout');
        }
      },

      updateUser: (userData) => {
        set((state) => ({ 
          user: { ...state.user, ...userData } 
        }));
      },

      // Validate and clean up auth state
      validateAndCleanup: () => {
        const { token, user, logout } = get();
        
        // Check if user data is valid
        if (!isValidUser(user)) {
          console.warn('Invalid user data detected, clearing auth state');
          logout();
          return false;
        }
        
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.warn('Token expired, clearing auth state');
          logout();
          return false;
        }
        
        return true;
      },

      // Initialize apiClient with stored token
      initAuth: () => {
        const { token, sessionToken, adminToken, validateAndCleanup } = get();
        
        // Validate state before initializing
        if (!validateAndCleanup()) {
          return;
        }
        
        if (token) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        if (sessionToken) {
          apiClient.defaults.headers.common['X-Session-Token'] = sessionToken;
        }
        if (adminToken) {
          apiClient.defaults.headers.common['X-Admin-Token'] = adminToken;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        refreshToken: state.refreshToken,
        sessionToken: state.sessionToken,
        adminToken: state.adminToken,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initAuth();
}


