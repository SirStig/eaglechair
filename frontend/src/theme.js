import { createTheme } from '@mui/material/styles';

// Create a custom Material UI theme with dark mode
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f4a52d', // Gold
      light: '#fbbf24',
      dark: '#d4af37',
      contrastText: '#1a1a1a',
    },
    secondary: {
      main: '#dc2626', // Red
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a1a1a', // Dark coal
      paper: '#2d2d2d', // Card background
    },
    text: {
      primary: '#d4d4d4', // Light text
      secondary: '#a3a3a3', // Muted text
      disabled: '#6b6b6b',
    },
    divider: '#525252',
    error: {
      main: '#dc2626',
    },
    warning: {
      main: '#f4a52d',
    },
    info: {
      main: '#3b82f6',
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#2d2d2d',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#2d2d2d',
        },
      },
    },
  },
});

export default theme;

