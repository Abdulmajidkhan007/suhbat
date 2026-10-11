import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onRecord?: () => void;
  disabled?: boolean;
}

const VoiceButton: React.FC<Props> = ({ onRecord, disabled = false }) => {
  const [recording, setRecording] = useState(false);

  const handleClick = () => {
    setRecording((prev) => !prev);
    onRecord?.();
  };

  return (
    <Tooltip title={recording ? 'Stop recording' : 'Record voice message'}>
      <IconButton
        onClick={handleClick}
        disabled={disabled}
        size="medium"
        sx={{
          color:   recording ? 'error.main' : 'text.secondary',
          bgcolor: recording ? 'error.50'   : 'transparent',
          '&:hover': { bgcolor: recording ? 'error.100' : 'action.hover' },
          transition: 'all 0.2s',
        }}
        aria-label={recording ? 'Stop recording' : 'Record voice message'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={recording ? 'off' : 'on'}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {recording ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MicOffIcon fontSize="small" />
              </motion.div>
            ) : (
              <MicIcon fontSize="small" />
            )}
          </motion.div>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
};

export default VoiceButton;
