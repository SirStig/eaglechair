import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        try {
          const response = await axios.post('/api/v1/auth/login', credentials);
          const { access_token, user } = response.data;
          
          set({ 
            user, 
            token: access_token, 
            isAuthenticated: true 
          });
          
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          
          return { success: true, user };
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || 'Login failed' 
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
          isAuthenticated: false 
        });
        delete axios.defaults.headers.common['Authorization'];
      },

      updateUser: (userData) => {
        set((state) => ({ 
          user: { ...state.user, ...userData } 
        }));
      },

      // Initialize axios with stored token
      initAuth: () => {
        const { token } = get();
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initAuth();
}


