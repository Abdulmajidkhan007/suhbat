import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Box, Divider, Typography } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { signIn, signUp, signInWithGoogle, setUser, clearError } from '../features/auth/authSlice';
import AuthLayout from '../layouts/AuthLayout';
import AuthForm from '../components/auth/AuthForm';
import GoogleButton from '../components/auth/GoogleButton';
import PhoneAuthForm from '../components/auth/PhoneAuthForm';
import { AppUser } from '../types';
import toast from 'react-hot-toast';

type AuthView = 'email' | 'phone';

const LoginPage: React.FC = () => {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, loading, error } = useAppSelector((s) => s.auth);
  const [formMode, setFormMode]     = useState<'login' | 'signup'>('login');
  const [authView, setAuthView]     = useState<AuthView>('email');
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (data: { email: string; password: string; displayName?: string }) => {
    let result;
    if (formMode === 'login') {
      result = await dispatch(signIn({ email: data.email, password: data.password }));
    } else {
      result = await dispatch(signUp({ email: data.email, password: data.password, displayName: data.displayName! }));
    }
    if (result.meta.requestStatus === 'fulfilled') {
      navigate(from, { replace: true });
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await dispatch(signInWithGoogle());
      if (result.meta.requestStatus === 'fulfilled') {
        navigate(from, { replace: true });
      } else {
        toast.error((result.payload as string) ?? 'Google bilan kirishda xato.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePhoneSuccess = (appUser: AppUser) => {
    dispatch(setUser(appUser));
    navigate(from, { replace: true });
  };

  const toggle = () => {
    dispatch(clearError());
    setFormMode((m) => (m === 'login' ? 'signup' : 'login'));
  };

  return (
    <AuthLayout
      title={
        authView === 'phone'
          ? 'Telefon bilan kirish'
          : formMode === 'login'
          ? 'Welcome back'
          : 'Create account'
      }
      subtitle={
        authView === 'phone'
          ? 'SMS tasdiqlash kodi yuboriladi'
          : formMode === 'login'
          ? 'Sign in to continue'
          : 'Join the conversation'
      }
    >
      <AnimatePresence mode="wait">
        {authView === 'phone' ? (
          <PhoneAuthForm
            key="phone"
            onSuccess={handlePhoneSuccess}
            onBack={() => setAuthView('email')}
          />
        ) : (
          <div key="email" className="flex flex-col gap-3">
            <AuthForm
              mode={formMode}
              loading={loading}
              error={error}
              onSubmit={handleSubmit}
              onToggle={toggle}
              onClearError={() => dispatch(clearError())}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                YOKI
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>

            <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} />

            <button
              type="button"
              onClick={() => setAuthView('phone')}
              style={{
                background: 'none',
                border: '1px solid',
                borderColor: 'rgba(128,128,128,0.3)',
                borderRadius: 10,
                cursor: 'pointer',
                color: 'inherit',
                padding: '10px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              📱 Telefon raqam bilan kirish
            </button>
          </div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
};

export default LoginPage;
