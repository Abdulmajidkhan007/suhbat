import React, { useEffect, useState } from 'react';
import { CircularProgress, Paper, Typography } from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import { useAppSelector } from '../../app/hooks';
import { socket } from '../../services/api';

/** Qisqa uzilishlarda (va ishga tushishda) miltillamasin. */
export const CONNECTION_GRACE_MS = 1500;

export type ConnectionStatus = 'online' | 'connecting' | 'offline';

/** Real vaqt ulanishi holati: brauzer oflayn / server bilan aloqa yo'q / hammasi joyida. */
export const useConnectionStatus = (enabled: boolean): ConnectionStatus => {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [socketDown, setSocketDown] = useState(false);

  useEffect(() => {
    const on  = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSocketDown(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (connected: boolean) => {
      clearTimeout(timer);
      if (connected) setSocketDown(false);
      else timer = setTimeout(() => setSocketDown(true), CONNECTION_GRACE_MS);
    };
    apply(socket.isConnected());
    const unsubscribe = socket.onConnectionChange(apply);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);

  if (!enabled) return 'online';
  if (!browserOnline) return 'offline';
  return socketDown ? 'connecting' : 'online';
};

/** Ekran tepasida kichik yorliq: "Internet yo'q" yoki "Ulanmoqda…". Faqat tizimga kirganda. */
const ConnectionBanner: React.FC = () => {
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const status = useConnectionStatus(signedIn);
  if (status === 'online') return null;
  return (
    <Paper
      role="status"
      aria-live="polite"
      elevation={4}
      sx={{
        position: 'fixed', top: 'calc(76px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
        zIndex: (t) => t.zIndex.snackbar, display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 0.75, borderRadius: 999, maxWidth: 'calc(100vw - 32px)',
        bgcolor: status === 'offline' ? 'error.main' : 'background.paper',
        color: status === 'offline' ? 'error.contrastText' : 'text.secondary',
      }}
    >
      {status === 'offline'
        ? <CloudOffOutlinedIcon fontSize="small" />
        : <CircularProgress size={14} color="inherit" />}
      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
        {status === 'offline' ? 'Internet yo\'q' : 'Ulanmoqda…'}
      </Typography>
    </Paper>
  );
};

export default ConnectionBanner;
