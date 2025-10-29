import { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/ui/Toast';

const ToastContext = createContext(null);

let toastId = 0;

/**
 * Toast Provider Component
 * 
 * Provides global toast notification functionality to the entire app
 * Automatically manages toast lifecycle and stacking
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, variant = 'info', duration = 5000) => {
    const id = ++toastId;
    const newToast = { id, message, variant, duration };
    
    setToasts((prev) => [...prev, newToast]);
    
    return id;
  }, []);

  // Convenience methods for common toast types
  const toast = {
    success: useCallback((message, duration) => showToast(message, 'success', duration), [showToast]),
    error: useCallback((message, duration) => showToast(message, 'error', duration), [showToast]),
    warning: useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]),
    info: useCallback((message, duration) => showToast(message, 'info', duration), [showToast]),
    show: showToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * useToast Hook
 * 
 * Provides access to toast notification methods
 * 
 * @example
 * const toast = useToast();
 * toast.success('Product saved successfully!');
 * toast.error('Failed to save product');
 * toast.warning('This action cannot be undone');
 * toast.info('Loading products...');
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};

export default ToastContext;
