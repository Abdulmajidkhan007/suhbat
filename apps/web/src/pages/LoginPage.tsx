import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signIn, signUp, clearError, recoveryCodesAcknowledged } from '../features/auth/authSlice';
import AuthLayout from '../layouts/AuthLayout';
import AuthForm from '../components/auth/AuthForm';
import RecoveryCodesView from '../components/auth/RecoveryCodesView';
import type { AuthFormData } from '../components/auth/AuthForm';

const LoginPage: React.FC = () => {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, loading, error, recoveryCodes } = useAppSelector((s) => s.auth);
  const [formMode, setFormMode]  = useState<'login' | 'signup'>('login');

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  // Ro'yxatdan o'tgach — avval tiklash kodlari (bir marta), keyin ilova.
  if (user && recoveryCodes) {
    return (
      <AuthLayout title="Tiklash kodlari" subtitle="Parolni unutsangiz — email'siz tiklash uchun">
        <RecoveryCodesView
          codes={recoveryCodes}
          onDone={() => {
            dispatch(recoveryCodesAcknowledged());
            navigate(from, { replace: true });
          }}
        />
      </AuthLayout>
    );
  }
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (data: AuthFormData) => {
    const result = formMode === 'login'
      ? await dispatch(signIn({ login: data.login, password: data.password }))
      : await dispatch(signUp({
        email: data.login, password: data.password, displayName: data.displayName ?? '',
        ...(data.username ? { username: data.username } : {}),
      }));
    // Ro'yxatdan o'tishda kodlar ekrani chiqadi (yuqorida), u yerdan davom etiladi.
    if (result.meta.requestStatus === 'fulfilled' && formMode === 'login') {
      navigate(from, { replace: true });
    }
  };

  const toggle = () => {
    dispatch(clearError());
    setFormMode((m) => (m === 'login' ? 'signup' : 'login'));
  };

  return (
    <AuthLayout
      title={formMode === 'login' ? 'Xush kelibsiz' : 'Hisob yaratish'}
      subtitle={formMode === 'login' ? 'Davom etish uchun kiring' : 'Suhbatga qo\'shiling'}
    >
      <div className="flex flex-col gap-3">
        <AuthForm
          mode={formMode}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          onToggle={toggle}
          onClearError={() => dispatch(clearError())}
        />
        <Typography variant="caption" align="center" sx={{ color: 'text.disabled' }}>
          Google va telefon raqam bilan kirish — tez orada
        </Typography>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
