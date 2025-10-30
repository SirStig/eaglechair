import apiClient from '../config/apiClient';
import { useAuthStore } from '../store/authStore';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor for automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another request is already refreshing, queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refreshToken, logout } = useAuthStore.getState();
      
      // If no refresh token, logout immediately
      if (!refreshToken) {
        isRefreshing = false;
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
      
      // Try to refresh the token using the refresh token
      try {
        const response = await apiClient.post(
          '/api/v1/auth/refresh',
          {},
          {
            headers: {
              'Authorization': `Bearer ${refreshToken}`
            }
          }
        );

        const { access_token, refresh_token } = response.data;
        
        // Update auth store with new tokens
        useAuthStore.setState({
          token: access_token,
          refreshToken: refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep existing
        });
        
        // Update apiClient headers
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        // Process queued requests
        processQueue(null, access_token);
        
        isRefreshing = false;
        
        // Retry original request
        originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Refresh failed, logout user
        logout();
        
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
