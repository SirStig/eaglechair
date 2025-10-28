import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, validateAndCleanup } = useAuthStore();
  const location = useLocation();

  // Validate auth state on mount to prevent undefined user data
  useEffect(() => {
    validateAndCleanup();
  }, [validateAndCleanup]);

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if admin access is required
  if (requireAdmin) {
    const isAdmin = user.type === 'admin' || 
                    user.role === 'super_admin' || 
                    user.role === 'admin' ||
                    user.role === 'editor';
    
    if (!isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;


