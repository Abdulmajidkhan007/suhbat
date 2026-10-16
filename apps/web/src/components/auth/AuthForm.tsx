import React, { useState } from 'react';
import {
  TextField, Typography, Alert, Divider, InputAdornment, IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { normalizeUsername } from '@suhbat/core';
import LoadingButton from '../common/LoadingButton';
import UsernameField from './UsernameField';
import { usernameAcceptable, useUsernameCheck } from '../../hooks/useUsernameCheck';
import { validateSignIn, validateSignUp } from '../../utils/validators';

type Mode = 'login' | 'signup';

export interface AuthFormData {
  /** Kirishda — email yoki username; ro'yxatdan o'tishda — email. */
  login:        string;
  password:     string;
  displayName?: string;
  /** Normallashtirilgan; bo'sh bo'lsa — yo'q. */
  username?:    string;
}

interface Props {
  mode:         Mode;
  loading:      boolean;
  error:        string | null;
  onSubmit:     (data: AuthFormData) => void;
  onToggle:     () => void;
  onClearError: () => void;
}

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

const AuthForm: React.FC<Props> = ({ mode, loading, error, onSubmit, onToggle, onClearError }) => {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [localError,  setLocalError]  = useState('');
  const usernameCheck = useUsernameCheck(mode === 'signup' ? username : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    onClearError();

    const validation =
      mode === 'login'
        ? validateSignIn(email, password)
        : validateSignUp(email, password, displayName);

    if (!validation.valid) {
      setLocalError(validation.message);
      return;
    }
    if (mode === 'login') {
      onSubmit({ login: email.trim(), password });
      return;
    }
    if (!usernameAcceptable(usernameCheck)) {
      setLocalError('message' in usernameCheck ? usernameCheck.message : 'Username tekshirilmoqda, biroz kuting.');
      return;
    }
    const normalized = normalizeUsername(username);
    onSubmit({ login: email.trim(), password, displayName, ...(normalized ? { username: normalized } : {}) });
  };

  const displayedError = error || localError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{    opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {displayedError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <Alert
              severity="error"
              sx={{ borderRadius: '10px' }}
              onClose={() => { setLocalError(''); onClearError(); }}
            >
              {displayedError}
            </Alert>
          </motion.div>
        )}

        {mode === 'signup' && (
          <TextField
            label="Ism"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            autoFocus={mode === 'signup'}
            required
            disabled={loading}
            sx={fieldSx}
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
        )}

        <TextField
          label={mode === 'login' ? 'Email yoki username' : 'Email'}
          type={mode === 'login' ? 'text' : 'email'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoFocus={mode === 'login'}
          autoComplete={mode === 'login' ? 'username' : 'email'}
          required
          disabled={loading}
          sx={fieldSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {mode === 'signup' && (
          <UsernameField value={username} onChange={setUsername} check={usernameCheck} disabled={loading} optional />
        )}

        <TextField
          label="Parol"
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          disabled={loading}
          sx={fieldSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPass((p) => !p)}
                    edge="end"
                    aria-label={showPass ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                  >
                    {showPass ? (
                      <VisibilityOffIcon fontSize="small" />
                    ) : (
                      <VisibilityIcon fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        {mode === 'login' && (
          <Typography variant="body2" align="right" sx={{ mt: -1 }}>
            <Typography
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Parolni unutdim?
            </Typography>
          </Typography>
        )}

        <LoadingButton
          type="submit"
          variant="contained"
          fullWidth
          loading={loading}
          size="large"
        >
          {mode === 'login' ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
        </LoadingButton>

        <Divider sx={{ my: 0.5 }}>
          <Typography variant="caption" color="text.secondary">yoki</Typography>
        </Divider>

        <Typography variant="body2" align="center" color="text.secondary">
          {mode === 'login' ? "Hisobingiz yo'qmi? " : 'Hisobingiz bormi? '}
          <button
            type="button"
            onClick={onToggle}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, color: 'inherit', fontSize: 'inherit' }}
          >
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {mode === 'login' ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
            </Typography>
          </button>
        </Typography>
      </form>
    </motion.div>
  );
};

export default AuthForm;
