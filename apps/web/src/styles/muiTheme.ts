import { createTheme, ThemeOptions } from '@mui/material';
import { palettes, type Palette } from '@suhbat/ui-tokens';

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

// Ranglar `@suhbat/ui-tokens` dan — mobil ilova bilan bir xil.
const paletteOptions = (p: Palette) => ({
  primary:    { main: p.primary, dark: p.primaryDark, light: p.primaryLight },
  secondary:  { main: p.secondary },
  background: { default: p.background, paper: p.surface },
  divider:    p.divider,
  text:       { primary: p.textPrimary, secondary: p.textSecondary, disabled: p.textDisabled },
});

export const lightTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'light',
    ...paletteOptions(palettes.light),
  },
});

export const darkTheme = createTheme({
  ...baseOptions,
  palette: {
    mode: 'dark',
    ...paletteOptions(palettes.dark),
  },
});
