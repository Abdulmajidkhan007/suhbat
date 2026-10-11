// src/hooks/useTheme.ts
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { toggleTheme, setTheme } from '../features/theme/themeSlice';
import { ThemeMode } from '../types';

export const useTheme = () => {
  const dispatch = useAppDispatch();
  const mode     = useAppSelector((s) => s.theme.mode);

  const toggle     = useCallback(() => dispatch(toggleTheme()), [dispatch]);
  const changeMode = useCallback((m: ThemeMode) => dispatch(setTheme(m)), [dispatch]);

  return { mode, toggle, changeMode };
};
