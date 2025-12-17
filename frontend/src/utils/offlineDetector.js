import { useState, useEffect } from 'react';
import logger from './logger';

const CONTEXT = 'OfflineDetector';

/**
 * Hook to detect offline/online status
 * Industry standard: Uses navigator.onLine and network events
 */
export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(
    typeof window !== 'undefined' ? !navigator.onLine : false
  );
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    const handleOnline = () => {
      logger.info(CONTEXT, 'Network connection restored');
      setIsOffline(false);
    };
    
    const handleOffline = () => {
      logger.warn(CONTEXT, 'Network connection lost');
      setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial status
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOffline;
};

export default useOffline;

