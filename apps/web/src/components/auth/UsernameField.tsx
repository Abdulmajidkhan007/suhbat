import React from 'react';
import { CircularProgress, InputAdornment, TextField } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { USERNAME_MAX } from '@suhbat/core';
import type { UsernameCheck } from '../../hooks/useUsernameCheck';

interface Props {
  value:     string;
  onChange:  (value: string) => void;
  check:     UsernameCheck;
  disabled?: boolean;
  size?:     'small' | 'medium';
  /** Ro'yxatdan o'tishda — "ixtiyoriy" izohi. */
  optional?: boolean;
}

const helperOf = (c: UsernameCheck, optional: boolean): string | undefined => {
  switch (c.status) {
    case 'empty':     return optional ? 'Ixtiyoriy. Keyin profilda o\'rnatish mumkin.' : 'Username yo\'q — sizni faqat ism bo\'yicha topishadi.';
    case 'current':   return 'Joriy username';
    case 'invalid':   return c.message;
    case 'checking':  return 'Tekshirilmoqda…';
    case 'available': return 'Bo\'sh — olish mumkin';
    case 'taken':     return c.message;
    case 'error':     return 'Tekshirib bo\'lmadi — saqlashda server tekshiradi';
  }
};

const UsernameField: React.FC<Props> = ({ value, onChange, check, disabled, size = 'medium', optional = false }) => {
  const error = check.status === 'invalid' || check.status === 'taken';
  return (
    <TextField
      label="Username"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      size={size}
      disabled={disabled}
      error={error}
      helperText={helperOf(check, optional)}
      autoComplete="username"
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
      slotProps={{
        htmlInput:      { 'maxLength': USERNAME_MAX + 1, 'autoCapitalize': 'none', 'spellCheck': false, 'aria-label': 'Username' },
        formHelperText: { sx: { color: check.status === 'available' ? 'success.main' : undefined } },
        input: {
          startAdornment: <InputAdornment position="start">@</InputAdornment>,
          endAdornment:   check.status === 'checking'
            ? <InputAdornment position="end"><CircularProgress size={16} aria-label="Tekshirilmoqda" /></InputAdornment>
            : check.status === 'available'
              ? <InputAdornment position="end"><CheckCircleIcon fontSize="small" color="success" /></InputAdornment>
              : undefined,
        },
      }}
    />
  );
};

export default UsernameField;
