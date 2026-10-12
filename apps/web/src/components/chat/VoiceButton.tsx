import React from 'react';
import { IconButton, Tooltip, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { motion } from 'framer-motion';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import type { RecordedVoice } from '../../hooks/useVoiceRecorder';
import { formatDuration } from '../../utils/formatters';

interface Props {
  onRecorded: (voice: RecordedVoice) => void;
  onError:    (message: string) => void;
  disabled?:  boolean;
}

/** Bosib yozishni boshlaydi; yozuv vaqtida — taymer, bekor qilish va yuborish (stop). */
const VoiceButton: React.FC<Props> = ({ onRecorded, onError, disabled = false }) => {
  const { supported, recording, elapsedMs, start, stop, cancel } = useVoiceRecorder({ onRecorded, onError });

  if (!supported) return null;

  if (!recording) {
    return (
      <Tooltip title="Ovozli xabar yozish">
        <span>
          <IconButton
            onClick={() => void start()}
            disabled={disabled}
            size="medium"
            sx={{ color: 'text.secondary', mb: 0.5 }}
            aria-label="Ovozli xabar yozish"
          >
            <MicIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1 mb-0.5" role="status" aria-label="Yozilmoqda">
      <Tooltip title="Bekor qilish">
        <IconButton onClick={cancel} size="small" aria-label="Yozuvni bekor qilish" sx={{ color: 'text.secondary' }}>
          <DeleteOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <motion.span
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="inline-block w-2 h-2 rounded-full bg-red-500"
      />
      <Typography variant="caption" sx={{ minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(elapsedMs)}
      </Typography>
      <Tooltip title="To'xtatib yuborish">
        <IconButton
          onClick={stop}
          size="medium"
          aria-label="To'xtatib yuborish"
          sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
        >
          <StopIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );
};

export default VoiceButton;
