import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, InputAdornment, TextField, Typography } from '@mui/material';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { ApiError } from '@suhbat/client';
import AuthLayout from '../layouts/AuthLayout';
import LoadingButton from '../components/common/LoadingButton';
import { api } from '../services/api';

const failureText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'Email yuborish hozircha sozlanmagan. Tiklash kodi bilan tiklang.';
    if (e.status === 429) return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
    if (e.status === 0) return e.message;
  }
  return 'So\'rovni yuborib bo\'lmadi. Qayta urinib ko\'ring.';
};

/** "Parolni unutdim": email yoki username → (hisob bo'lsa) xatda havola. */
const ForgotPasswordPage: React.FC = () => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Email yoki username kiriting.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSent((await api.forgotPassword(value.trim())).message);
    } catch (err) {
      setError(failureText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Parolni tiklash" subtitle="Hisobingiz emaili yoki username'ini kiriting">
      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert severity="success" sx={{ borderRadius: '10px' }}>{sent}</Alert>
          <Typography variant="body2" color="text.secondary">
            Havola 30 daqiqa amal qiladi. Xat kelmasa, bir necha daqiqadan keyin qayta so'rang.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ textTransform: 'none', borderRadius: '10px' }}>
            Kirish sahifasiga qaytish
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error && (
            <Alert
              severity="error"
              sx={{ borderRadius: '10px' }}
              onClose={() => setError(null)}
              action={error.includes('Tiklash kodi') ? (
                <Button component={RouterLink} to="/recover" color="inherit" size="small">Kod bilan</Button>
              ) : undefined}
            >
              {error}
            </Alert>
          )}
          <TextField
            label="Email yoki username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            autoFocus
            autoComplete="username"
            disabled={loading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <LoadingButton type="submit" variant="contained" fullWidth loading={loading} size="large">
            Havola yuborish
          </LoadingButton>
          <Button
            component={RouterLink}
            to="/recover"
            variant="outlined"
            fullWidth
            size="large"
            sx={{ textTransform: 'none', borderRadius: '10px' }}
          >
            Tiklash kodi bilan
          </Button>
          <Typography variant="body2" align="center">
            <Typography component={RouterLink} to="/login" variant="body2" sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}>
              Kirish sahifasiga qaytish
            </Typography>
          </Typography>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
