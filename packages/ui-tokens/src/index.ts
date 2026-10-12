// Dizayn tokenlari — veb (MUI) va mobil (React Native) uchun bitta manba.
// Faqat oddiy qiymatlar: hech qaysi UI kutubxonasiga bog'liq emas.

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  primary:       string;
  primaryDark:   string;
  primaryLight:  string;
  secondary:     string;
  background:    string;
  surface:       string;
  divider:       string;
  textPrimary:   string;
  textSecondary: string;
  textDisabled:  string;
  /** Yuborilgan xabar pufakchasi. */
  bubbleOwn:     string;
  bubbleOwnText: string;
  bubbleOther:   string;
  danger:        string;
  online:        string;
}

export const palettes: Readonly<Record<ColorScheme, Palette>> = {
  light: {
    primary:       '#3b82f6',
    primaryDark:   '#2563eb',
    primaryLight:  '#60a5fa',
    secondary:     '#8b5cf6',
    background:    '#f1f5f9',
    surface:       '#ffffff',
    divider:       'rgba(0,0,0,0.08)',
    textPrimary:   'rgba(0,0,0,0.87)',
    textSecondary: 'rgba(0,0,0,0.55)',
    textDisabled:  'rgba(0,0,0,0.35)',
    bubbleOwn:     '#3b82f6',
    bubbleOwnText: '#ffffff',
    bubbleOther:   '#ffffff',
    danger:        '#dc2626',
    online:        '#22c55e',
  },
  dark: {
    primary:       '#60a5fa',
    primaryDark:   '#3b82f6',
    primaryLight:  '#93c5fd',
    secondary:     '#a78bfa',
    background:    '#0f1117',
    surface:       '#161b22',
    divider:       'rgba(255,255,255,0.08)',
    textPrimary:   'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.55)',
    textDisabled:  'rgba(255,255,255,0.30)',
    bubbleOwn:     '#2563eb',
    bubbleOwnText: '#ffffff',
    bubbleOther:   '#1f2937',
    danger:        '#f87171',
    online:        '#4ade80',
  },
};

/** 4 px qadam. */
export const spacing = (n: number): number => n * 4;

export const radius = { sm: 6, md: 12, lg: 18, full: 999 } as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22 } as const;
