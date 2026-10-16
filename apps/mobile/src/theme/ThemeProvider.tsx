import type { ColorScheme } from '@suhbat/ui-tokens';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { keychainPrefsStorage } from '../services/prefsStorage';
import type { PrefsStorage } from '../services/prefsStorage';
import { applyAccent, isAccentKey } from './accents';
import type { AccentKey } from './accents';
import { basePalettes } from './colors';
import type { Palette } from './colors';

export type { Palette } from './colors';
export type ThemeMode = 'system' | 'light' | 'dark';

const isThemeMode = (v: unknown): v is ThemeMode => v === 'system' || v === 'light' || v === 'dark';

interface Theme {
  scheme:    ColorScheme;
  mode:      ThemeMode;
  accent:    AccentKey;
  palette:   Palette;
  setMode:   (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
}

const noop = () => undefined;
const ThemeContext = createContext<Theme>({
  scheme: 'light', mode: 'system', accent: 'blue', palette: basePalettes.light, setMode: noop, setAccent: noop,
});

interface Props {
  children: ReactNode;
  /** Testlar uchun. */
  storage?: PrefsStorage;
}

/** Yorug'/qorong'i (yoki tizimga ergashish) va asosiy rang; tanlov qurilmada saqlanadi. */
export const ThemeProvider = ({ children, storage = keychainPrefsStorage }: Props) => {
  const system: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<AccentKey>('blue');

  useEffect(() => {
    let cancelled = false;
    void storage.load().then((prefs) => {
      if (cancelled) return;
      if (isThemeMode(prefs.mode)) setModeState(prefs.mode);
      if (isAccentKey(prefs.accent)) setAccentState(prefs.accent);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void storage.save({ mode: next, accent });
  }, [storage, accent]);

  const setAccent = useCallback((next: AccentKey) => {
    setAccentState(next);
    void storage.save({ mode, accent: next });
  }, [storage, mode]);

  const scheme: ColorScheme = mode === 'system' ? system : mode;
  const value = useMemo<Theme>(
    () => ({ scheme, mode, accent, palette: applyAccent(basePalettes[scheme], scheme, accent), setMode, setAccent }),
    [scheme, mode, accent, setMode, setAccent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);

/**
 * Palitraga bog'liq uslublar — palitra o'zgargandagina qayta yaratiladi.
 * `factory` modul darajasida e'lon qilinsin (`StyleSheet.create` qaytaradi).
 */
export const useStyles = <T,>(factory: (p: Palette) => T): T => {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
};
