import React from 'react';
import { CircularProgress, Typography } from '@mui/material';
import { motion } from 'framer-motion';

interface Props {
  message?: string;
}

const FullscreenLoader: React.FC<Props> = ({ message = 'Loading…' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{    opacity: 0 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
    style={{ background: 'var(--mui-palette-background-default)' }}
  >
    <CircularProgress size={40} thickness={3} />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </motion.div>
);

export default FullscreenLoader;
