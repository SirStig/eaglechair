// Theme transition utility for smooth transitions between dark and light themes
// Actual transition happens via CSS on the page background
export const createThemeTransition = () => {
  return Promise.resolve();
};

// Simple function to check if pathname should use light theme
export const shouldUseLightTheme = (pathname) => {
  const lightThemePages = ['/products', '/product'];
  return lightThemePages.some(page => pathname.startsWith(page));
};

// Hook to detect if current page should use light theme (for backwards compatibility)
export const useLightTheme = (pathname) => {
  return shouldUseLightTheme(pathname);
};

// Light theme classes
export const lightThemeClasses = {
  background: 'bg-gradient-to-br from-cream-50 to-cream-100',
  surface: 'bg-cream-50/80 backdrop-blur-sm',
  card: 'bg-white/90 border-cream-200',
  text: {
    primary: 'text-slate-800',
    secondary: 'text-slate-600',
    muted: 'text-slate-500'
  },
  border: 'border-cream-200',
  shadow: 'shadow-cream-200/50'
};

// Dark theme classes (existing)
export const darkThemeClasses = {
  background: 'bg-dark-800',
  surface: 'bg-dark-600',
  card: 'bg-dark-600 border-dark-500',
  text: {
    primary: 'text-dark-50',
    secondary: 'text-dark-100',
    muted: 'text-dark-200'
  },
  border: 'border-dark-500',
  shadow: 'shadow-dark-900/50'
};
