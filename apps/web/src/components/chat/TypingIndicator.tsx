import React from 'react';
import { Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  typingNames: string[];
}

const Dot: React.FC<{ delay: number }> = ({ delay }) => (
  <motion.span
    animate={{ y: [0, -4, 0] }}
    transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
    className="inline-block w-1.5 h-1.5 rounded-full bg-current"
  />
);

const TypingIndicator: React.FC<Props> = ({ typingNames }) => {
  if (typingNames.length === 0) return null;

  const label =
    typingNames.length === 1
      ? `${typingNames[0]} is typing`
      : typingNames.length === 2
      ? `${typingNames[0]} and ${typingNames[1]} are typing`
      : 'Several people are typing';

  return (
    <AnimatePresence>
      <motion.div
        key="typing"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{    opacity: 0, y: 6 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-4 py-1"
      >
        <div className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
          <Dot delay={0} />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
        </div>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {label}
        </Typography>
      </motion.div>
    </AnimatePresence>
  );
};

export default TypingIndicator;
