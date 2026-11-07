// src/components/auth/ForcePasswordChange.tsx — admin vaqtinchalik parol bergan: yangi parol o'rnatilmaguncha ilova ochilmaydi.
import React, { useState } from 'react';
import { Alert, Button, TextField, Typography } from '@mui/material';
import { ApiError } from '@suhbat/client';
import { PASSWORD_MAX } from '@suhbat/core';
import { useAppDispatch } from '../../app/hooks';
import { signOut, userUpdated } from '../../features/auth/authSlice';
import AuthLayout from '../../layouts/AuthLayout';
import { api } from '../../services/api';
import { toAppUser } from '../../services/apiMappers';
import { errorText } from '../../utils/errors';
import LoadingButton from '../common/LoadingButton';
import NewPasswordFields, { newPasswordError } from './NewPasswordFields';

const ForcePasswordChange: React.FC = () => {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return setError('Vaqtinchalik parolni kiriting.');
    const invalid = newPasswordError(password, confirm);
    if (invalid) return setError(invalid);
    setLoading(true);
    setError(null);
    try {
      dispatch(userUpdated(toAppUser(await api.changePassword(current, password))));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? 'Vaqtinchalik parol noto\'g\'ri.' : errorText(err, 'Parolni o\'zgartirib bo\'lmadi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Yangi parol o'rnating" subtitle="Administrator sizga vaqtinchalik parol berdi">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
        <TextField
          label="Vaqtinchalik parol"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          fullWidth
          autoFocus
          autoComplete="current-password"
          disabled={loading}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          slotProps={{ htmlInput: { maxLength: PASSWORD_MAX } }}
        />
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} disabled={loading} />
        <Typography variant="caption" color="text.secondary">Boshqa qurilmalardagi sessiyalar yopiladi.</Typography>
        <LoadingButton type="submit" variant="contained" size="large" fullWidth loading={loading}>Parolni saqlash</LoadingButton>
        <Button onClick={() => void dispatch(signOut())} disabled={loading} sx={{ textTransform: 'none' }}>Chiqish</Button>
      </form>
    </AuthLayout>
  );
};

export default ForcePasswordChange;
