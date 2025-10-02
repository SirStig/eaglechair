import { useState, useCallback } from 'react';
import api from '../config/api';

/**
 * Custom hook for making API calls with loading and error states
 * @returns {Object} API utilities and state
 */
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall();
      setLoading(false);
      return { data: response.data, error: null };
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { data: null, error: errorMessage };
    }
  }, []);

  const get = useCallback((url, config = {}) => {
    return request(() => api.get(url, config));
  }, [request]);

  const post = useCallback((url, data, config = {}) => {
    return request(() => api.post(url, data, config));
  }, [request]);

  const put = useCallback((url, data, config = {}) => {
    return request(() => api.put(url, data, config));
  }, [request]);

  const del = useCallback((url, config = {}) => {
    return request(() => api.delete(url, config));
  }, [request]);

  const patch = useCallback((url, data, config = {}) => {
    return request(() => api.patch(url, data, config));
  }, [request]);

  return {
    loading,
    error,
    get,
    post,
    put,
    del,
    patch,
    request,
  };
};

export default useApi;

