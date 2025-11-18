import { create } from 'zustand';
import apiClient from '../config/apiClient';
import logger from '../utils/logger';

const AUTH_CONTEXT = 'AuthStore';

// localStorage keys for token storage
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const SESSION_TOKEN_KEY = 'auth_session_token'; // For admin users
const ADMIN_TOKEN_KEY = 'auth_admin_token'; // For admin users
const USER_KEY = 'auth_user';

// Helper function to validate user object
const isValidUser = (user) => {
  if (!user || typeof user !== 'object') return false;
  // Check for required fields
  return user.id && (user.email || user.username);
};

export const useAuthStore = create(
  (set, get) => ({
      user: null,
      isAuthenticated: false,
      isInitializing: false,

      login: async (credentials, cartStore = null) => {
        try {
          // Use configured API client with proper base URL
          // Tokens are returned in response body and stored in localStorage
          const data = await apiClient.post('/api/v1/auth/login', credentials);
          
          // Extract tokens and user data from response
          const accessToken = data.access_token;
          const refreshToken = data.refresh_token;
          const sessionToken = data.session_token; // Admin only
          const adminToken = data.admin_token; // Admin only
          const user = data.user;
          
          // Validate user data
          if (!isValidUser(user)) {
            throw new Error('Invalid user data received from server');
          }
          
          // Store tokens and user in localStorage for persistent sessions
          if (accessToken) {
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          }
          if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          }
          // Store admin-specific tokens if present
          if (sessionToken) {
            localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
          }
          if (adminToken) {
            localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
          }
          if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
          }
          
          set({ 
            user, 
            isAuthenticated: true 
          });
          
          // Merge guest cart if cartStore is provided
          if (cartStore && typeof cartStore.switchToAuthMode === 'function') {
            try {
              await cartStore.switchToAuthMode();
              logger.info(AUTH_CONTEXT, 'Guest cart merged on login');
            } catch (error) {
              logger.error(AUTH_CONTEXT, 'Error merging cart on login', error);
            }
          }
          
          logger.info(AUTH_CONTEXT, 'Login successful, tokens stored in localStorage');
          return { success: true, user };
        } catch (error) {
          console.error('Login error:', error);
          
          // Error is normalized by apiClient - check both normalized format and raw response
          const errorData = error.data || error.response?.data || {};
          const errorStatus = error.status || error.response?.status || error.data?.status_code || 0;
          const errorCode = errorData.error || errorData.error_code || '';
          const errorDetail = errorData.detail || errorData.message || error.message || '';
          const errorMessage = errorDetail || 'Login failed';
          
          // Check for verification error by error code or message content
          const isVerificationError = 
            errorStatus === 403 && 
            (errorCode === 'ACCOUNT_NOT_VERIFIED' ||
             errorMessage.toLowerCase().includes('verified') || 
             errorMessage.toLowerCase().includes('verification') ||
             errorMessage.toLowerCase().includes('not verified') ||
             errorMessage.toLowerCase().includes('needs to be verified'));
          
          // Clear any partial state (unless it's a verification error - user exists)
          if (!isVerificationError) {
            // Don't call logout if we're already handling an error - just clear state
            set({ 
              user: null, 
              isAuthenticated: false 
            });
          }
          
          return { 
            success: false,
            requiresVerification: isVerificationError,
            error: errorMessage
          };
        }
      },

      register: async (userData, cartStore = null) => {
        try {
          // Tokens are returned in response body and stored in localStorage
          const data = await apiClient.post('/api/v1/auth/register', userData);
          
          // Backend now returns a message that email verification is required
          // No tokens/user data until email is verified
          if (data.message || data.verified === false) {
            // Registration successful but email not verified
            return { 
              success: true, 
              requiresVerification: true,
              email: data.email,
              message: data.message || 'Registration successful! Please verify your email.'
            };
          }
          
          // Legacy support: if user is returned (shouldn't happen with new flow)
          const accessToken = data.access_token;
          const refreshToken = data.refresh_token;
          const sessionToken = data.session_token; // Admin only
          const adminToken = data.admin_token; // Admin only
          const { user } = data;
          if (user && isValidUser(user)) {
            // Store tokens and user in localStorage
            if (accessToken) {
              localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            }
            if (refreshToken) {
              localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
            }
            if (sessionToken) {
              localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
            }
            if (adminToken) {
              localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
            }
            if (user) {
              localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
            
            set({ 
              user, 
              isAuthenticated: true 
            });
            
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
          }
          
          // Default success response
          return { 
            success: true, 
            requiresVerification: true,
            email: userData.rep_email || userData.email,
            message: 'Registration successful! Please verify your email.'
          };
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.detail || error.response?.data?.message || 'Registration failed' 
          };
        }
      },

      logout: async (cartStore = null) => {
        try {
          // Call backend logout endpoint (may fail if tokens are invalid, that's OK)
          await apiClient.post('/api/v1/auth/logout', {});
        } catch (error) {
          // Even if logout fails (e.g., tokens expired), clear local state anyway
          // This is expected if tokens are already invalid
          if (error.response?.status !== 401) {
            logger.warn(AUTH_CONTEXT, 'Logout request failed', error);
          }
        }
        
        // Clear tokens and user from localStorage
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        
        // Clear local state
        set({ 
          user: null, 
          isAuthenticated: false 
        });
        
        // Switch cart to guest mode if cartStore is provided
        if (cartStore && typeof cartStore.switchToGuestMode === 'function') {
          cartStore.switchToGuestMode();
          logger.info(AUTH_CONTEXT, 'Switched to guest cart on logout');
        }
        
        logger.info(AUTH_CONTEXT, 'Logout successful, localStorage cleared');
      },

      updateUser: (userData) => {
        const updatedUser = { ...get().user, ...userData };
        set({ user: updatedUser });
        
        // Update user in localStorage
        if (updatedUser) {
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }
      },

      // Validate and clean up auth state
      // NOTE: This should be called sparingly to avoid redirect loops
      // ProtectedRoute no longer calls this - it relies on isInitializing flag
      validateAndCleanup: async () => {
        const { user, isInitializing } = get();
        
        // Don't validate if auth is still initializing
        if (isInitializing) {
          logger.debug(AUTH_CONTEXT, 'Auth still initializing, skipping validation');
          return true;
        }
        
        // Check if user data is valid
        if (!isValidUser(user)) {
          // Only clear if we also don't have tokens (might be a temporary state during init)
          const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          
          if (!accessToken && !refreshToken) {
            logger.warn(AUTH_CONTEXT, 'Invalid user data and no tokens, clearing auth state');
            // Don't call logout here - just clear state to avoid redirect loops
            set({ 
              user: null, 
              isAuthenticated: false 
            });
            return false;
          } else {
            // We have tokens but invalid user - might be during initialization, don't clear yet
            logger.debug(AUTH_CONTEXT, 'Invalid user data but tokens exist, waiting for validation');
            return true;
          }
        }
        
        // Check if tokens exist in localStorage
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        
        if (!accessToken && !refreshToken) {
          // Only clear if user is also invalid
          if (!isValidUser(user)) {
            logger.debug(AUTH_CONTEXT, 'No tokens and invalid user, clearing auth state');
            // Don't call logout here - just clear state to avoid redirect loops
            set({ 
              user: null, 
              isAuthenticated: false 
            });
            return false;
          } else {
            // User is valid but no tokens - might be a race condition, don't clear
            logger.debug(AUTH_CONTEXT, 'No tokens but valid user, skipping cleanup');
            return true;
          }
        }
        
        // Token validation is handled by the backend
        // If tokens are invalid/expired, the backend will return 401
        // and the apiClient interceptor will handle it
        return true;
      },

      // Initialize auth state on app load
      initAuth: async () => {
        try {
          // Set initializing flag to prevent premature redirects
          set({ isInitializing: true });
          
          // Check localStorage for stored tokens and user data
          const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
          const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
          const storedUser = localStorage.getItem(USER_KEY);
          
          // Check if this is an admin session (has admin tokens)
          const isAdminSession = sessionToken && adminToken;
          
          // If we have tokens, try to restore the session
          if (accessToken || refreshToken) {
            let userData = null;
            
            // Parse stored user data if available
            if (storedUser) {
              try {
                userData = JSON.parse(storedUser);
              } catch (e) {
                logger.warn(AUTH_CONTEXT, 'Failed to parse stored user data', e);
              }
            }
            
            // If we have user data, restore it immediately for faster UX
            // But prioritize admin data if we have admin tokens
            if (userData && isValidUser(userData)) {
              // If we have admin tokens but stored user is not admin, don't restore yet
              // Wait for backend validation to get correct user type
              if (isAdminSession && userData.type !== 'admin') {
                logger.debug(AUTH_CONTEXT, 'Admin tokens found but stored user is not admin, waiting for backend validation');
              } else {
                set({ 
                  user: userData, 
                  isAuthenticated: true,
                  isInitializing: true // Still initializing, will be set to false after backend validation
                });
                logger.info(AUTH_CONTEXT, 'Restored user from localStorage');
              }
            }
            
            // Validate session with backend (tokens may have expired)
            try {
              const responseData = await apiClient.get('/api/v1/auth/me');
              
              // The backend now returns the correct format based on token type
              // Admin tokens return: {id, username, email, firstName, lastName, role, type: 'admin'}
              // Company tokens return: Company object with company_name, rep_email, etc.
              
              let validatedUser = responseData;
              
              // Check if response is admin format (has username and type='admin')
              if (responseData && responseData.type === 'admin' && responseData.username) {
                // This is already in the correct admin format from backend
                validatedUser = {
                  id: responseData.id,
                  username: responseData.username,
                  email: responseData.email,
                  firstName: responseData.firstName,
                  lastName: responseData.lastName,
                  role: responseData.role,
                  type: 'admin'
                };
              } 
              // Check if response is company format (has company_name, no type or type='company')
              else if (responseData && (responseData.company_name || (!responseData.type && !responseData.username))) {
                // This is a company response - transform to user format
                validatedUser = {
                  id: responseData.id,
                  companyName: responseData.company_name,
                  email: responseData.rep_email,
                  firstName: responseData.rep_first_name,
                  lastName: responseData.rep_last_name,
                  role: 'company',
                  type: 'company',
                  status: responseData.status?.value || responseData.status
                };
              }
              // If response already has type, use it as-is
              else if (responseData && responseData.type) {
                validatedUser = responseData;
              }
              
              // If validation successful, update stored user data
              if (validatedUser && isValidUser(validatedUser)) {
                localStorage.setItem(USER_KEY, JSON.stringify(validatedUser));
                set({ 
                  user: validatedUser, 
                  isAuthenticated: true,
                  isInitializing: false
                });
                logger.info(AUTH_CONTEXT, `Session validated with backend - user type: ${validatedUser.type}`);
                return;
              }
            } catch (error) {
              // Token validation failed - tokens are expired or invalid
              if (error.response?.status === 401) {
                logger.debug(AUTH_CONTEXT, 'Tokens expired or invalid, clearing session');
                // Try to refresh token
                const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
                if (refreshTokenValue) {
                  try {
                    // Attempt token refresh using Authorization header
                    const refreshData = await apiClient.post('/api/v1/auth/refresh', {}, {
                      headers: {
                        Authorization: `Bearer ${refreshTokenValue}`
                      }
                    });
                    
                    // Update tokens in localStorage
                    if (refreshData.access_token) {
                      localStorage.setItem(ACCESS_TOKEN_KEY, refreshData.access_token);
                    }
                    if (refreshData.refresh_token) {
                      localStorage.setItem(REFRESH_TOKEN_KEY, refreshData.refresh_token);
                    }
                    // Note: Admin tokens (session_token, admin_token) are NOT refreshed
                    // They persist from login until logout - keep existing ones in localStorage
                    
                    // Retry /auth/me with new token
                    const retryData = await apiClient.get('/api/v1/auth/me');
                    let retryUser = retryData;
                    
                    if (retryData && !retryData.type && retryData.company_name) {
                      retryUser = {
                        id: retryData.id,
                        companyName: retryData.company_name,
                        email: retryData.rep_email,
                        firstName: retryData.rep_first_name,
                        lastName: retryData.rep_last_name,
                        role: 'company',
                        type: 'company',
                        status: retryData.status?.value || retryData.status
                      };
                    }
                    
                    if (retryUser && isValidUser(retryUser)) {
                      localStorage.setItem(USER_KEY, JSON.stringify(retryUser));
                      set({ 
                        user: retryUser, 
                        isAuthenticated: true,
                        isInitializing: false
                      });
                      logger.info(AUTH_CONTEXT, 'Session restored after token refresh');
                      return;
                    }
                  } catch (refreshError) {
                    logger.debug(AUTH_CONTEXT, 'Token refresh failed', refreshError);
                  }
                }
              } else {
                logger.debug(AUTH_CONTEXT, 'Auth validation error', error);
              }
            }
          }
          
          // If we get here, no valid session was found
          // Clear any stale state
          set({ isInitializing: false });
          get().logout();
        } catch (error) {
          logger.error(AUTH_CONTEXT, 'Error during auth initialization', error);
          // On error, clear state
          set({ isInitializing: false });
          get().logout();
        }
      },
    })
);

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initAuth().catch(err => {
    console.error('Failed to initialize auth:', err);
  });
}


