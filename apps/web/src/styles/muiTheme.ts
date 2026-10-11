import { createTheme, ThemeOptions } from '@mui/material';

const baseOptions: ThemeOptions = {
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    h6:   { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    body2:  { fontSize: '0.875rem' },
    button: { fontWeight: 600, textTransform: 'none' as const },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: '0.75rem', borderRadius: 6 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundImage: 'none' },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'light',
    primary: { main: '#3b82f6', dark: '#2563eb', light: '#60a5fa' },
    secondary: { main: '#8b5cf6' },
    background: { default: '#f1f5f9', paper: '#ffffff' },
    divider: 'rgba(0,0,0,0.08)',
    text: {
      primary:   'rgba(0,0,0,0.87)',
      secondary: 'rgba(0,0,0,0.55)',
      disabled:  'rgba(0,0,0,0.35)',
    },
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'dark',
    primary: { main: '#60a5fa', dark: '#3b82f6', light: '#93c5fd' },
    secondary: { main: '#a78bfa' },
    background: { default: '#0f1117', paper: '#161b22' },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary:   'rgba(255,255,255,0.92)',
      secondary: 'rgba(255,255,255,0.55)',
      disabled:  'rgba(255,255,255,0.30)',
    },
  },
});
