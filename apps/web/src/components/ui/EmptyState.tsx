import React from 'react';
import { Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';

interface Props {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?:      { label: string; onClick: () => void };
}

const EmptyState: React.FC<Props> = ({ icon, title, description, action }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    className="flex flex-col items-center justify-center text-center px-6 py-12 gap-3"
  >
    {icon && (
      <div className="text-5xl mb-2 opacity-40">{icon}</div>
    )}
    <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
        {description}
      </Typography>
    )}
    {action && (
      <Button
        variant="contained"
        size="small"
        onClick={action.onClick}
        sx={{ mt: 1, borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
      >
        {action.label}
      </Button>
    )}
  </motion.div>
);

export default EmptyState;
