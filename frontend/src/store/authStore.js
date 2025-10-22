import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      sessionToken: null,
      adminToken: null,
      isAuthenticated: false,

      login: async (credentials) => {
        try {
          const response = await axios.post('http://localhost:8000/api/v1/auth/login', credentials);
          const data = response.data;
          
          // Extract data from response
          const accessToken = data.access_token;
          const user = data.user;
          const sessionToken = data.session_token;
          const adminToken = data.admin_token;
          
          if (!user) {
            throw new Error('Invalid response: user data missing');
          }
          
          set({ 
            user, 
            token: accessToken, 
            sessionToken,
            adminToken,
            isAuthenticated: true 
          });
          
          // Set axios default headers
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Set admin tokens if present (for admin users)
          if (sessionToken) {
            axios.defaults.headers.common['X-Session-Token'] = sessionToken;
          }
          if (adminToken) {
            axios.defaults.headers.common['X-Admin-Token'] = adminToken;
          }
          
          return { success: true, user };
        } catch (error) {
          console.error('Login error:', error);
          return { 
            success: false, 
            error: error.response?.data?.detail || error.message || 'Login failed' 
          };
        }
      },

      register: async (userData) => {
        try {
          const response = await axios.post('/api/v1/auth/register', userData);
          const { access_token, user } = response.data;
          
          set({ 
            user, 
            token: access_token, 
            isAuthenticated: true 
          });
          
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          
          return { success: true, user };
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Registration failed' 
          };
        }
      },

      logout: () => {
        set({ 
          user: null, 
          token: null,
          sessionToken: null,
          adminToken: null,
          isAuthenticated: false 
        });
        delete axios.defaults.headers.common['Authorization'];
        delete axios.defaults.headers.common['X-Session-Token'];
        delete axios.defaults.headers.common['X-Admin-Token'];
      },

      updateUser: (userData) => {
        set((state) => ({ 
          user: { ...state.user, ...userData } 
        }));
      },

      // Initialize axios with stored token
      initAuth: () => {
        const { token, sessionToken, adminToken } = get();
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        if (sessionToken) {
          axios.defaults.headers.common['X-Session-Token'] = sessionToken;
        }
        if (adminToken) {
          axios.defaults.headers.common['X-Admin-Token'] = adminToken;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
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


