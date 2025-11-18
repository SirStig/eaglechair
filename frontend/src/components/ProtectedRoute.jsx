import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, isInitializing } = useAuthStore();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);

  // Only check auth state once on mount, not on every render
  useEffect(() => {
    // Skip if already checked or still initializing
    if (hasCheckedRef.current || isInitializing) {
      if (!isInitializing) {
        setIsChecking(false);
      }
      return;
    }

    // Wait for initialization to complete
    const checkAuth = async () => {
      // Wait a bit for initialization to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If still initializing after delay, wait for it
      if (isInitializing) {
        return;
      }
      
      hasCheckedRef.current = true;
      setIsChecking(false);
    };
    
    checkAuth();
  }, [isInitializing]);

  // Wait for auth initialization to complete before making decisions
  if (isInitializing || isChecking) {
    // Show loading state while checking
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-200">Loading...</p>
        </div>
      </div>
    );
  }

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


