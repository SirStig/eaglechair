/**
 * Desktop View Mode Utility
 * 
 * Manages desktop view mode preference for mobile devices
 * Uses localStorage to persist the user's choice
 */

const DESKTOP_VIEW_KEY = 'eaglechair_desktop_view';

/**
 * Check if desktop view mode is enabled
 * @returns {boolean} True if desktop view is enabled
 */
export const isDesktopViewEnabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DESKTOP_VIEW_KEY) === 'true';
};

/**
 * Enable desktop view mode
 */
export const enableDesktopView = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DESKTOP_VIEW_KEY, 'true');
  // Add class to body to trigger CSS changes
  document.body.classList.add('desktop-view-mode');
};

/**
 * Disable desktop view mode (use mobile responsive view)
 */
export const disableDesktopView = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DESKTOP_VIEW_KEY, 'false');
  // Remove class from body
  document.body.classList.remove('desktop-view-mode');
};

/**
 * Toggle desktop view mode
 * @returns {boolean} New state (true if enabled, false if disabled)
 */
export const toggleDesktopView = () => {
  const currentState = isDesktopViewEnabled();
  if (currentState) {
    disableDesktopView();
    return false;
  } else {
    enableDesktopView();
    return true;
  }
};

/**
 * Initialize desktop view mode on page load
 * Should be called in the main App component or Layout
 */
export const initDesktopViewMode = () => {
  if (typeof window === 'undefined') return;
  
  if (isDesktopViewEnabled()) {
    document.body.classList.add('desktop-view-mode');
  } else {
    document.body.classList.remove('desktop-view-mode');
  }
};

export default {
  isDesktopViewEnabled,
  enableDesktopView,
  disableDesktopView,
  toggleDesktopView,
  initDesktopViewMode,
};

