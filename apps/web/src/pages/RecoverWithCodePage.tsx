import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, TextField, Typography } from '@mui/material';
import { ApiError } from '@suhbat/client';
import { normalizeRecoveryCode } from '@suhbat/core';
import AuthLayout from '../layouts/AuthLayout';
import LoadingButton from '../components/common/LoadingButton';
import NewPasswordFields, { newPasswordError } from '../components/auth/NewPasswordFields';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signOut } from '../features/auth/authSlice';
import { api } from '../services/api';

const failureText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'Login yoki tiklash kodi noto\'g\'ri (har bir kod faqat bir marta ishlaydi).';
    if (e.status === 429) return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
    if (e.status === 0) return e.message;
  }
  return 'Parolni tiklab bo\'lmadi. Qayta urinib ko\'ring.';
};

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

/** Emailsiz tiklash: login + ro'yxatdan o'tishda saqlangan bir martalik kod + yangi parol. */
const RecoverWithCodePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => Boolean(s.auth.user));
  const [login, setLogin] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const codeInvalid = code.trim().length > 0 && normalizeRecoveryCode(code) === null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim()) return setError('Email yoki username kiriting.');
    if (!normalizeRecoveryCode(code)) return setError('Kod ko\'rinishi: XXXX-XXXX-XXXX (12 belgi).');
    const pwError = newPasswordError(password, confirm);
    if (pwError) return setError(pwError);
    setLoading(true);
    setError(null);
    try {
      await api.recoverWithCode(login.trim(), code.trim(), password);
      setDone(true);
      // Server barcha sessiyalarni yopdi — shu brauzerdagi eski sessiya ham tozalanadi.
      if (signedIn) void dispatch(signOut());
    } catch (err) {
      setError(failureText(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Parol yangilandi">
        <div className="flex flex-col gap-4">
          <Alert severity="success" sx={{ borderRadius: '10px' }}>
            Yangi parol o'rnatildi, ishlatilgan kod endi yaroqsiz. Barcha qurilmalardagi sessiyalar yopildi — yangi parol bilan kiring.
            Kodlar kamayib qolsa, Sozlamalarda yangisini yarating.
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ textTransform: 'none', borderRadius: '10px' }}>
            Kirish
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Tiklash kodi bilan" subtitle="Ro'yxatdan o'tishda saqlagan kodlaringizdan birini kiriting">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }} onClose={() => setError(null)}>{error}</Alert>}
        <TextField
          label="Email yoki username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          fullWidth
          autoFocus
          autoComplete="username"
          disabled={loading}
          sx={fieldSx}
        />
        <TextField
          label="Tiklash kodi"
          placeholder="XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          fullWidth
          autoComplete="one-time-code"
          disabled={loading}
          error={codeInvalid}
          helperText={codeInvalid ? '12 belgi: harf va raqamlar' : undefined}
          sx={fieldSx}
          slotProps={{ htmlInput: { maxLength: 32, spellCheck: false, style: { fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' } } }}
        />
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} disabled={loading} />
        <LoadingButton type="submit" variant="contained" fullWidth loading={loading} size="large">
          Parolni tiklash
        </LoadingButton>
        <Typography variant="body2" align="center">
          <Typography component={RouterLink} to="/login" variant="body2" sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}>
            Kirish sahifasiga qaytish
          </Typography>
        </Typography>
      </form>
    </AuthLayout>
  );
};

export default RecoverWithCodePage;
