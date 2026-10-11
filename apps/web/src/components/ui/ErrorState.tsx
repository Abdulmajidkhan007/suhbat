import React from 'react';
import { Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { motion } from 'framer-motion';

interface Props {
  message?:  string;
  onRetry?:  () => void;
  compact?:  boolean;
}

const ErrorState: React.FC<Props> = ({
  message = 'Something went wrong.',
  onRetry,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={`flex flex-col items-center justify-center text-center gap-2 ${compact ? 'py-4 px-3' : 'py-12 px-6'}`}
  >
    <ErrorOutlineIcon sx={{ fontSize: compact ? 28 : 40, color: 'error.main', opacity: 0.7 }} />
    <Typography variant={compact ? 'body2' : 'body1'} color="text.secondary">
      {message}
    </Typography>
    {onRetry && (
      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={onRetry}
        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, mt: 0.5 }}
      >
        Retry
      </Button>
    )}
  </motion.div>
);

export default ErrorState;
