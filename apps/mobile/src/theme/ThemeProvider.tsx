import { palettes } from '@suhbat/ui-tokens';
import type { ColorScheme, Palette } from '@suhbat/ui-tokens';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

interface Theme {
  scheme:  ColorScheme;
  palette: Palette;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', palette: palettes.light });

/** Tizim rejimiga (yorug'/qorong'i) ergashadi. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({ scheme, palette: palettes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);

/**
 * Palitraga bog'liq uslublar — rejim o'zgargandagina qayta yaratiladi.
 * `factory` modul darajasida e'lon qilinsin (`StyleSheet.create` qaytaradi).
 */
export const useStyles = <T,>(factory: (p: Palette) => T): T => {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
};
