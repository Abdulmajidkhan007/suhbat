import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ChatIcon from '@mui/icons-material/Chat';

interface Props {
  title:       string;
  subtitle?:   string;
  children:    React.ReactNode;
}

const AuthLayout: React.FC<Props> = ({ title, subtitle, children }) => (
  <Box
    className="min-h-screen flex items-center justify-center p-4"
    sx={{
      background: (theme) =>
        theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0f1117 0%, #161b22 50%, #0f1117 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #eff6ff 100%)',
    }}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md"
    >
      <Paper
        elevation={0}
        className="p-8 rounded-2xl"
        sx={{
          border:  '1px solid',
          borderColor: 'divider',
          boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <Box
              className="flex items-center justify-center rounded-2xl"
              sx={{ width: 52, height: 52, bgcolor: 'primary.main' }}
            >
              <ChatIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
          </motion.div>
          <Typography variant="h5" align="center" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" align="center">
              {subtitle}
            </Typography>
          )}
        </div>

        {children}
      </Paper>
    </motion.div>
  </Box>
);

export default AuthLayout;
