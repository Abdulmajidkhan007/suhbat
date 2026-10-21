// src/components/auth/NewPasswordFields.tsx — yangi parol + tasdiq (kuch o'lchagich bilan).
import React, { useState } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { PASSWORD_MAX, PASSWORD_MIN } from '@suhbat/core';
import PasswordStrengthMeter from './PasswordStrengthMeter';

interface Props {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

/** Formani yuborishdan oldin: `null` — hammasi to'g'ri, aks holda xato matni. */
export const newPasswordError = (password: string, confirm: string): string | null => {
  if (password.length < PASSWORD_MIN) return `Parol kamida ${PASSWORD_MIN} belgi bo'lsin.`;
  if (password !== confirm) return 'Parollar mos emas.';
  return null;
};

const NewPasswordFields: React.FC<Props> = ({ password, confirm, onPassword, onConfirm, disabled, size }) => {
  const [show, setShow] = useState(false);
  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const visibility = (
    <InputAdornment position="end">
      <IconButton size="small" edge="end" onClick={() => setShow((v) => !v)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}>
        {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );
  return (
    <>
      <TextField
        label="Yangi parol"
        type={show ? 'text' : 'password'}
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        fullWidth
        size={size}
        autoComplete="new-password"
        disabled={disabled}
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
        onChange={(e) => onConfirm(e.target.value)}
        fullWidth
        size={size}
        autoComplete="new-password"
        disabled={disabled}
        error={mismatch}
        helperText={mismatch ? 'Parollar mos emas' : undefined}
        sx={fieldSx}
        slotProps={{ htmlInput: { maxLength: PASSWORD_MAX } }}
      />
    </>
  );
};

export default NewPasswordFields;
