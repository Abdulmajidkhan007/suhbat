import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { mode, toggle } = useTheme();

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton onClick={toggle} size="medium" aria-label="Toggle theme">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0,   opacity: 1, scale: 1 }}
            exit={{    rotate:  90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {mode === 'dark' ? (
              <LightModeIcon sx={{ color: 'text.secondary' }} />
            ) : (
              <DarkModeIcon sx={{ color: 'text.secondary' }} />
            )}
          </motion.div>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
