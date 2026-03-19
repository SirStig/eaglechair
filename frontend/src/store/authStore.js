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

      login: async (credentials) => {
        try {
          const data = await apiClient.post('/api/v1/auth/login', credentials);
          const accessToken = data.access_token;
          const refreshToken = data.refresh_token;
          const sessionToken = data.session_token;
          const adminToken = data.admin_token;
          const user = data.user;

          if (!isValidUser(user)) {
            throw new Error('Invalid user data received from server');
          }

          if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
          if (adminToken) localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
          if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

          set({ user, isAuthenticated: true });

          logger.info(AUTH_CONTEXT, 'Login successful, tokens stored in localStorage');
          return { success: true, user, requiresSetup: data.requiresSetup };
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
          
          const requiresTwoFactor = errorMessage.toLowerCase().includes('two-factor') ||
            errorMessage.toLowerCase().includes('2fa') ||
            (errorCode === 'INVALID_INPUT' && errorData?.field === 'two_factor_code');
          return {
            success: false,
            requiresVerification: isVerificationError,
            requiresTwoFactor,
            error: errorMessage
          };
        }
      },

      loginWithPasskey: async () => {
        try {
          const { getPasskey } = await import('../utils/passkey');
          const { getPasskeyAuthOptions, authenticateWithPasskey } = await import('../services/adminAuthService');
          const options = await getPasskeyAuthOptions();
          const credential = await getPasskey(options);
          if (!credential) return { success: false, error: 'Passkey sign-in was cancelled' };
          const data = await authenticateWithPasskey({
            options,
            credential
          });
          const { access_token, refresh_token, session_token, admin_token, user } = data;
          if (!isValidUser(user)) throw new Error('Invalid user data');
          if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
          if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
          if (session_token) localStorage.setItem(SESSION_TOKEN_KEY, session_token);
          if (admin_token) localStorage.setItem(ADMIN_TOKEN_KEY, admin_token);
          if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
          set({ user, isAuthenticated: true });
          return { success: true, user, requiresSetup: data.requiresSetup };
        } catch (error) {
          const msg = error.response?.data?.detail || error.message || 'Passkey sign-in failed';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
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
            
            set({ user, isAuthenticated: true });
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
          set({ isInitializing: true });

          const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
          const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
          const storedUser = localStorage.getItem(USER_KEY);
          const isAdminSession = sessionToken && adminToken;

          const validateAndRestoreSession = async () => {
            const responseData = await apiClient.get('/api/v1/auth/me');
            let validatedUser = responseData;
            if (responseData && responseData.type === 'admin' && responseData.username) {
              validatedUser = {
                id: responseData.id,
                username: responseData.username,
                email: responseData.email,
                firstName: responseData.firstName,
                lastName: responseData.lastName,
                role: responseData.role,
                type: 'admin'
              };
            } else if (responseData && (responseData.company_name || (!responseData.type && !responseData.username))) {
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
            } else if (responseData && responseData.type) {
              validatedUser = responseData;
            }
            if (validatedUser && isValidUser(validatedUser)) {
              localStorage.setItem(USER_KEY, JSON.stringify(validatedUser));
              set({ user: validatedUser, isAuthenticated: true, isInitializing: false });
              return validatedUser;
            }
            return null;
          };

          const tryCookieRefresh = async () => {
            try {
              const refreshData = await apiClient.post('/api/v1/auth/refresh', {});
              if (refreshData.access_token) localStorage.setItem(ACCESS_TOKEN_KEY, refreshData.access_token);
              if (refreshData.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refreshData.refresh_token);
              return refreshData.access_token;
            } catch {
              return null;
            }
          };

          if (accessToken || refreshToken) {
            let userData = null;
            if (storedUser) {
              try {
                userData = JSON.parse(storedUser);
              } catch (e) {
                logger.warn(AUTH_CONTEXT, 'Failed to parse stored user data', e);
              }
            }
            if (userData && isValidUser(userData) && (!isAdminSession || userData.type === 'admin')) {
              set({ user: userData, isAuthenticated: true, isInitializing: true });
              logger.info(AUTH_CONTEXT, 'Restored user from localStorage');
            }
            try {
              const restored = await validateAndRestoreSession();
              if (restored) {
                logger.info(AUTH_CONTEXT, `Session validated - user type: ${restored.type}`);
                return;
              }
            } catch (error) {
              if (error.response?.status === 401) {
                const newToken = refreshToken
                  ? (await (async () => {
                      try {
                        const d = await apiClient.post('/api/v1/auth/refresh', {}, {
                          headers: { Authorization: `Bearer ${refreshToken}` }
                        });
                        if (d.access_token) localStorage.setItem(ACCESS_TOKEN_KEY, d.access_token);
                        if (d.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, d.refresh_token);
                        return d.access_token;
                      } catch {
                        return null;
                      }
                    })())
                  : await tryCookieRefresh();
                if (newToken) {
                  const retried = await validateAndRestoreSession();
                  if (retried) {
                    logger.info(AUTH_CONTEXT, 'Session restored after token refresh');
                    return;
                  }
                }
              }
            }
          } else {
            try {
              const restored = await validateAndRestoreSession();
              if (restored) {
                logger.info(AUTH_CONTEXT, 'Session restored from cookies (localStorage was empty)');
                return;
              }
            } catch (error) {
              if (error.response?.status === 401) {
                const newToken = await tryCookieRefresh();
                if (newToken) {
                  const retried = await validateAndRestoreSession();
                  if (retried) {
                    logger.info(AUTH_CONTEXT, 'Session restored from cookie refresh');
                    return;
                  }
                }
              }
            }
          }
          // Clear any stale state but don't call logout() to avoid redirect loops
          // Just clear the state silently - logout() will be called by ProtectedRoute if needed
          set({ 
            isInitializing: false,
            user: null,
            isAuthenticated: false
          });
          // Clear localStorage tokens if they exist but are invalid
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        } catch (error) {
          logger.error(AUTH_CONTEXT, 'Error during auth initialization', error);
          // On error, clear state but don't call logout() to avoid redirect loops
          set({ 
            isInitializing: false,
            user: null,
            isAuthenticated: false
          });
          // Clear localStorage tokens
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
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


