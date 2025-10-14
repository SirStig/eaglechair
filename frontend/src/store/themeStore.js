import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultTheme = {
  primaryColor: '#8b7355',
  secondaryColor: '#627d98',
  accentColor: '#ffc107',
  logo: null,
  companyName: 'Eagle Chair',
};

export const useThemeStore = create(
  persist(
    (set, get) => ({
      ...defaultTheme,
      
      updateTheme: (themeUpdates) => {
        set((state) => ({ ...state, ...themeUpdates }));
        get().applyTheme();
      },

      resetTheme: () => {
        set(defaultTheme);
        get().applyTheme();
      },

      applyTheme: () => {
        const state = get();
        const root = document.documentElement;
        
        root.style.setProperty('--primary-color', state.primaryColor);
        root.style.setProperty('--secondary-color', state.secondaryColor);
        root.style.setProperty('--accent-color', state.accentColor);
      },

      loadThemeFromAPI: async () => {
        try {
          const response = await fetch('/api/v1/admin/theme');
          if (response.ok) {
            const theme = await response.json();
            set(theme);
            get().applyTheme();
          }
        } catch (error) {
          console.error('Failed to load theme from API:', error);
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({
        primaryColor: state.primaryColor,
        secondaryColor: state.secondaryColor,
        accentColor: state.accentColor,
        logo: state.logo,
        companyName: state.companyName,
      }),
    }
  )
);

// Apply theme on load
if (typeof window !== 'undefined') {
  useThemeStore.getState().applyTheme();
}


