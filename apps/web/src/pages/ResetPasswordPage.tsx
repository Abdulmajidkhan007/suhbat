import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { ApiError } from '@suhbat/client';
import { PASSWORD_MAX, PASSWORD_MIN } from '@suhbat/core';
import AuthLayout from '../layouts/AuthLayout';
import LoadingButton from '../components/common/LoadingButton';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signOut } from '../features/auth/authSlice';
import { api } from '../services/api';

const failureText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'Havola yaroqsiz yoki muddati o\'tgan. Yangi havola so\'rang.';
    if (e.status === 429) return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
    if (e.status === 0) return e.message;
  }
  return 'Parolni yangilab bo\'lmadi. Qayta urinib ko\'ring.';
};

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

/**
 * Xatdagi havola: `/reset-password?token=…`. Token darhol URL'dan olib tashlanadi
 * (brauzer tarixi, Referer va ekran ulashishda ko'rinmasligi uchun) va faqat xotirada qoladi.
 */
const ResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => Boolean(s.auth.user));
  const [token] = useState(() => new URLSearchParams(location.search).get('token')?.trim() ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // history.replaceState (react-router orqali — router holati ham mos qoladi).
    if (location.search) navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`Parol kamida ${PASSWORD_MIN} belgi bo'lsin.`);
    if (password !== confirm) return setError('Parollar mos emas.');
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      // Server barcha sessiyalarni yopdi — shu brauzerdagi eski sessiya ham tozalanadi.
      if (signedIn) void dispatch(signOut());
    } catch (err) {
      setError(failureText(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Parolni tiklash">
        <div className="flex flex-col gap-4">
          <Alert severity="warning" sx={{ borderRadius: '10px' }}>
            Havola to'liq emas. Xatdagi havolani qayta oching yoki yangi havola so'rang.
          </Alert>
          <Button component={RouterLink} to="/forgot-password" variant="contained" size="large" sx={{ textTransform: 'none', borderRadius: '10px' }}>
            Yangi havola so'rash
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Parol yangilandi">
        <div className="flex flex-col gap-4">
          <Alert severity="success" sx={{ borderRadius: '10px' }}>
            Yangi parol o'rnatildi. Xavfsizlik uchun barcha qurilmalardagi sessiyalar yopildi — yangi parol bilan kiring.
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ textTransform: 'none', borderRadius: '10px' }}>
            Kirish
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const visibility = (
    <InputAdornment position="end">
      <IconButton size="small" edge="end" onClick={() => setShow((v) => !v)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}>
        {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthLayout title="Yangi parol" subtitle="Hisobingiz uchun yangi parol o'ylab toping">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <Alert
            severity="error"
            sx={{ borderRadius: '10px' }}
            onClose={() => setError(null)}
            action={error.includes('Yangi havola') ? (
              <Button component={RouterLink} to="/forgot-password" color="inherit" size="small">So'rash</Button>
            ) : undefined}
          >
            {error}
          </Alert>
        )}
        {/* Parol menejeri uchun yashirin username maydoni yo'q — faqat yangi parol. */}
        <TextField
          label="Yangi parol"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoFocus
          autoComplete="new-password"
          disabled={loading}
          error={tooShort}
          helperText={tooShort ? `Kamida ${PASSWORD_MIN} belgi` : undefined}
          sx={fieldSx}
          slotProps={{ htmlInput: { maxLength: PASSWORD_MAX }, input: { endAdornment: visibility } }}
        />
        <PasswordStrengthMeter password={password} />
        <TextField
          label="Parolni tasdiqlang"
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          autoComplete="new-password"
          disabled={loading}
          error={mismatch}
          helperText={mismatch ? 'Parollar mos emas' : undefined}
          sx={fieldSx}
          slotProps={{ htmlInput: { maxLength: PASSWORD_MAX } }}
        />
        <LoadingButton type="submit" variant="contained" fullWidth loading={loading} size="large">
          Parolni saqlash
        </LoadingButton>
        <Typography variant="caption" color="text.secondary" align="center">
          Saqlangach barcha qurilmalardan chiqasiz.
        </Typography>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
