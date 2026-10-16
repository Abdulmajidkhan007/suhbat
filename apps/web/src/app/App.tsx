import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import AppRouter from './router';
import { lightTheme, darkTheme } from '../styles/muiTheme';
import { useAppDispatch, useAppSelector } from './hooks';
import { systemThemeChanged } from '../features/theme/themeSlice';
import ConnectionBanner from '../components/common/ConnectionBanner';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../styles/global.css';

const ThemedApp: React.FC = () => {
  const mode = useAppSelector((s) => s.theme.mode);
  const dispatch = useAppDispatch();
  useAuth();

  // Tizim rejimi o'zgarsa (masalan, kechqurun avtomatik qorong'i) — tanlov qilinmagan bo'lsa ergashadi.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => dispatch(systemThemeChanged(e.matches ? 'dark' : 'light'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [dispatch]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [mode]);

  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <AnimatePresence mode="wait">
        <AppRouter />
      </AnimatePresence>
      <ConnectionBanner />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            fontFamily:   "'Inter', sans-serif",
            fontSize:     '0.875rem',
          },
        }}
      />
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemedApp />
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
