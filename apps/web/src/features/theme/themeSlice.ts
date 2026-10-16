// src/features/theme/themeSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ThemeState, ThemeMode } from '../../types';

const STORAGE_KEY = 'themeMode';

const isMode = (v: unknown): v is ThemeMode => v === 'light' || v === 'dark';

/** Saqlangan tanlov (bo'lmasa — null). localStorage yopiq bo'lsa (maxfiy rejim) ham yiqilmaydi. */
export const readStoredMode = (): ThemeMode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isMode(v) ? v : null;
  } catch {
    return null;
  }
};

/** Foydalanuvchi tanlamagan bo'lsa — tizim (OS/brauzer) rejimi. */
export const systemMode = (): ThemeMode =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const persist = (mode: ThemeMode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // saqlab bo'lmasa — joriy sessiyada ishlaydi
  }
};

const stored = readStoredMode();

const initialState: ThemeState = {
  mode:   stored ?? systemMode(),
  follow: stored === null,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      state.follow = false;
      persist(state.mode);
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      state.follow = false;
      persist(action.payload);
    },
    /** Tizim rejimi o'zgardi — faqat foydalanuvchi o'zi tanlamagan bo'lsa qo'llanadi. */
    systemThemeChanged(state, action: PayloadAction<ThemeMode>) {
      if (state.follow) state.mode = action.payload;
    },
  },
});

export const { toggleTheme, setTheme, systemThemeChanged } = themeSlice.actions;
export default themeSlice.reducer;
