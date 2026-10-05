import { create } from 'zustand';
import apiClient, { purgeStoredTokens } from '../config/apiClient';
import logger from '../utils/logger';
import { safeSetItem } from '../utils/safeStorage';

const AUTH_CONTEXT = 'AuthStore';

// Auth tokens live only in httpOnly cookies set by the backend - they are
// never stored in (or readable from) JS. Only the non-secret user profile is
// cached in localStorage so the UI can render immediately on reload.
const USER_KEY = 'auth_user';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearStoredUser = () => {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Storage unavailable
  }
};

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
      // True until initAuth() has checked the session. The server render and
      // the client's first (hydration) render both see this logged-out,
      // initializing shape; the cached profile is applied after mount.
      isInitializing: true,

      login: async (credentials) => {
        try {
          // Backend sets httpOnly auth cookies; the body only carries the profile
          const data = await apiClient.post('/api/v1/auth/login', credentials);
          const user = data.user;

          if (!isValidUser(user)) {
            throw new Error('Invalid user data received from server');
          }

          // Only the non-secret profile is cached (for instant UI on reload)
          const storageOk = safeSetItem(USER_KEY, JSON.stringify(user));

          set({ user, isAuthenticated: true });

          if (storageOk) {
            logger.info(AUTH_CONTEXT, 'Login successful (session held in httpOnly cookies)');
          } else {
            // Session cookies are set; only the cached profile could not be saved
            logger.warn(AUTH_CONTEXT, 'Login successful, but user profile could not be cached');
          }
          return { success: true, user, requiresSetup: data.requiresSetup, sessionPersisted: true };
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
          // Server stores the challenge and returns a single-use challengeId
          // Usernameless: the browser offers the passkeys saved for this site
          const { challengeId, ...publicKeyOptions } = await getPasskeyAuthOptions();
          const credential = await getPasskey(publicKeyOptions);
          if (!credential) return { success: false, error: 'Passkey sign-in was cancelled' };
          const data = await authenticateWithPasskey({
            challengeId,
            credential
          });
          const { user } = data;
          if (!isValidUser(user)) throw new Error('Invalid user data');
          if (!safeSetItem(USER_KEY, JSON.stringify(user))) {
            logger.warn(AUTH_CONTEXT, 'Passkey login successful, but user profile could not be cached');
          }
          set({ user, isAuthenticated: true });
          return { success: true, user, requiresSetup: data.requiresSetup, sessionPersisted: true };
        } catch (error) {
          const msg = error.data?.message || error.response?.data?.detail || error.message || 'Passkey sign-in failed';
          return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
        }
      },

      register: async (userData) => {
        try {
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
          // Any session is carried by httpOnly cookies set by the backend
          const { user } = data;
          if (user && isValidUser(user)) {
            if (!safeSetItem(USER_KEY, JSON.stringify(user))) {
              logger.warn(AUTH_CONTEXT, 'Registration successful, but user profile could not be cached');
            }

            set({ user, isAuthenticated: true });
            return { success: true, user, sessionPersisted: true };
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
          // Backend revokes all tokens and clears the httpOnly auth cookies
          await apiClient.post('/api/v1/auth/logout', {});
        } catch (error) {
          // Even if logout fails (e.g., tokens expired), clear local state anyway
          // This is expected if tokens are already invalid
          if (error.response?.status !== 401) {
            logger.warn(AUTH_CONTEXT, 'Logout request failed', error);
          }
        }
        
        // Clear cached user profile (and any legacy tokens) from storage
        purgeStoredTokens();
        clearStoredUser();
        
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
        
        logger.info(AUTH_CONTEXT, 'Logout successful');
      },

      // Re-read the admin profile (role / permissions) after it may have changed
      refreshUser: async () => {
        const { user } = get();
        if (!user || user.type !== 'admin') return user;
        try {
          const profile = await apiClient.get('/api/v1/auth/me');
          if (profile && profile.type === 'admin' && isValidUser(profile)) {
            const updatedUser = { ...user, ...profile };
            safeSetItem(USER_KEY, JSON.stringify(updatedUser));
            set({ user: updatedUser });
            return updatedUser;
          }
        } catch (error) {
          logger.warn(AUTH_CONTEXT, 'Could not refresh admin profile', error);
        }
        return user;
      },

      updateUser: (userData) => {
        const updatedUser = { ...get().user, ...userData };
        set({ user: updatedUser });
        
        // Update user in localStorage
        if (updatedUser) {
          safeSetItem(USER_KEY, JSON.stringify(updatedUser));
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
        
        // Check if user data is valid (tokens are httpOnly cookies, not visible here)
        if (!isValidUser(user)) {
          logger.warn(AUTH_CONTEXT, 'Invalid user data, clearing auth state');
          // Don't call logout here - just clear state to avoid redirect loops
          set({
            user: null,
            isAuthenticated: false
          });
          return false;
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

          // Tokens from older builds must not linger in Web Storage
          purgeStoredTokens();

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
                permissions: Array.isArray(responseData.permissions) ? responseData.permissions : undefined,
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
                status: responseData.status?.value || responseData.status,
                isVerified: responseData.is_verified
              };
            } else if (responseData && responseData.type) {
              validatedUser = responseData;
            }
            if (validatedUser && isValidUser(validatedUser)) {
              safeSetItem(USER_KEY, JSON.stringify(validatedUser));
              set({ user: validatedUser, isAuthenticated: true, isInitializing: false });
              return validatedUser;
            }
            return null;
          };

          // Show the cached profile while the cookie session is validated.
          // Every login path caches the profile, so without one this browser
          // has no session: skip /auth/me (+ refresh) for anonymous visitors.
          const userData = readStoredUser();
          if (!userData || !isValidUser(userData)) {
            clearStoredUser();
            set({ isInitializing: false, user: null, isAuthenticated: false });
            return;
          }
          set({ user: userData, isAuthenticated: true, isInitializing: true });
          logger.info(AUTH_CONTEXT, 'Restored cached user profile, validating session');

          // /auth/me is authenticated by the httpOnly cookies. On 401 the
          // apiClient interceptor refreshes via the refresh_token cookie and
          // retries once, so a single call covers both cases.
          try {
            const restored = await validateAndRestoreSession();
            if (restored) {
              logger.info(AUTH_CONTEXT, `Session validated - user type: ${restored.type}`);
              return;
            }
          } catch {
            // Not signed in (or session revoked/expired)
          }
          // Clear any stale state but don't call logout() to avoid redirect loops
          // Just clear the state silently - logout() will be called by ProtectedRoute if needed
          set({
            isInitializing: false,
            user: null,
            isAuthenticated: false
          });
          clearStoredUser();
        } catch (error) {
          logger.error(AUTH_CONTEXT, 'Error during auth initialization', error);
          // On error, clear state but don't call logout() to avoid redirect loops
          set({ 
            isInitializing: false,
            user: null,
            isAuthenticated: false
          });
          clearStoredUser();
        }
      },
    })
);

// Initialize auth once, after the app has mounted (see AuthInit in App.jsx).
// Running it at module load would apply the cached profile before
// hydrateRoot, so the first client render would differ from the SSR HTML.
let authInitStarted = false;
export const startAuthInit = () => {
  if (authInitStarted || typeof window === 'undefined') return;
  authInitStarted = true;
  useAuthStore.getState().initAuth().catch(err => {
    console.error('Failed to initialize auth:', err);
  });
};


