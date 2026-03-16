import { useState, useEffect } from 'react';

/**
 * Detects whether the app is running as an installed PWA (standalone mode).
 * Works with both the standard CSS media query and iOS Safari's legacy flag.
 */
export function useStandalone() {
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = () => {
      setIsStandalone(
        mq.matches || window.navigator.standalone === true
      );
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isStandalone;
}
