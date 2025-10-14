/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark coal backgrounds
        dark: {
          950: '#0a0a0a', // Deepest black
          900: '#121212', // Near black
          800: '#1a1a1a', // Dark coal
          700: '#242424', // Lighter coal
          600: '#2d2d2d', // Card background
          500: '#3a3a3a', // Elevated surface
          400: '#525252', // Borders
          300: '#6b6b6b', // Disabled
          200: '#858585', // Muted text
          100: '#a3a3a3', // Secondary text
          50: '#d4d4d4',  // Primary text
        },
        // Gold/Yellow accents (primary)
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f4a52d', // Main gold
          600: '#d4af37', // Darker gold
          700: '#b8922f',
          800: '#997725',
          900: '#7a5f1d',
        },
        // Red accents (secondary)
        secondary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626', // Main red
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Additional accent colors
        accent: {
          gold: '#d4af37',
          red: '#dc2626',
          yellow: '#f4a52d',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}


