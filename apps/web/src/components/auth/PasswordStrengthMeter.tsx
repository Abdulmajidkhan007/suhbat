import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { passwordStrength } from '../../utils/passwordStrength';

const COLORS = ['error', 'error', 'warning', 'info', 'success'] as const;

/** Parol kuchi ko'rsatkichi (yangi parol maydoni ostida). */
const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const { level, label } = passwordStrength(password);
  return (
    <Box className="flex items-center gap-2" aria-live="polite">
      <LinearProgress
        variant="determinate"
        value={Math.max(10, level * 25)}
        color={COLORS[level]}
        sx={{ flex: 1, height: 6, borderRadius: 3 }}
        aria-label="Parol kuchi"
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, textAlign: 'right' }}>
        {label}
      </Typography>
    </Box>
  );
};

export default PasswordStrengthMeter;
