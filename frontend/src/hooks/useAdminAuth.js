import { useContext } from 'react';
import AdminAuthContext from '../contexts/AdminAuthContext';

/**
 * Hook to use AdminAuthContext
 * 
 * Provides admin-specific auth checks and methods
 * 
 * Usage:
 * const { isAdmin, hasAdminPermission, logAdminAction } = useAdminAuth();
 * 
 * if (isAdmin()) {
 *   // Show edit mode UI
 * }
 */
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  
  return context;
};

export default useAdminAuth;
