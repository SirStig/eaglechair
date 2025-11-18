import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import logger from '../utils/logger';

const CONTEXT = 'ScrollToTop';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Instant scroll, no animation
    });
    
    logger.debug(CONTEXT, `Scrolled to top for route: ${pathname}`);
  }, [pathname]);

  return null;
}

export default ScrollToTop;

