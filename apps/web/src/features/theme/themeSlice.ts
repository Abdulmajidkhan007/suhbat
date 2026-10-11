// src/features/theme/themeSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ThemeState, ThemeMode } from '../../types';

const stored = localStorage.getItem('themeMode') as ThemeMode | null;

const initialState: ThemeState = {
  mode: stored ?? 'light',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', state.mode);
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      localStorage.setItem('themeMode', action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
