import React from 'react';
import { Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 800, opacity: 0.12 }}>
          404
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Page not found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          The page you're looking for doesn't exist.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')} sx={{ borderRadius: '10px' }}>
          Go home
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
