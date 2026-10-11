import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

interface Props extends ButtonProps {
  loading?: boolean;
  children: React.ReactNode;
}

const LoadingButton: React.FC<Props> = ({ loading = false, children, disabled, ...rest }) => (
  <Button
    {...rest}
    disabled={disabled || loading}
    sx={{
      position:   'relative',
      minWidth:   '120px',
      fontWeight: 600,
      borderRadius: '10px',
      textTransform: 'none',
      py: 1.25,
      ...rest.sx,
    }}
  >
    {loading && (
      <CircularProgress
        size={18}
        sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'inherit' }}
      />
    )}
    <span style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.2s' }}>{children}</span>
  </Button>
);

export default LoadingButton;
