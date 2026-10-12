import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IconButton, Tooltip, Paper, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { motion, AnimatePresence } from 'framer-motion';
import { ATTACHMENT_RULES } from '@suhbat/core';
import VoiceButton from './VoiceButton';
import type { RecordedVoice } from '../../hooks/useVoiceRecorder';

/** `<input type=file accept>` — server qabul qiladigan rasm va fayl turlari. */
const ACCEPT = [...ATTACHMENT_RULES.image.mimes, ...ATTACHMENT_RULES.file.mimes].join(',');

interface Props {
  onSend:       (content: string) => void;
  onTyping:     (isTyping: boolean) => void;
  onAttach:     (file: File) => void;
  onVoice:      (voice: RecordedVoice) => void;
  onError:      (message: string) => void;
  disabled?:    boolean;
  /** Berilsa, yozish o'rniga shu matn ko'rsatiladi (masalan kanalda oddiy a'zo). */
  readOnlyReason?: string;
  placeholder?: string;
}

const MessageComposer: React.FC<Props> = ({
  onSend,
  onTyping,
  onAttach,
  onVoice,
  onError,
  disabled = false,
  readOnlyReason,
  placeholder = 'Xabar yozing…',
}) => {
  const [text, setText]         = useState('');
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const textAreaRef             = useRef<HTMLTextAreaElement>(null);

  // Har o'zgarishda xabar beramiz; tez-tez yubormaslik `useMessages` da.
  const handleChange = (value: string) => {
    setText(value);
    onTyping(value.trim().length > 0);
  };

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    onTyping(false);
  }, [text, disabled, onSend, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = '';
  };

  const canSend = text.trim().length > 0 && !disabled;

  if (readOnlyReason) {
    return (
      <Paper elevation={0} className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-center" sx={{ bgcolor: 'background.paper' }}>
        <Typography variant="body2" color="text.secondary">{readOnlyReason}</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      className="border-t border-gray-100 dark:border-gray-800"
      sx={{ bgcolor: 'background.paper' }}
    >
      <div className="flex items-end gap-1 px-3 py-2">
        <Tooltip title="Fayl biriktirish">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            sx={{ color: 'text.secondary', mb: 0.5 }}
            aria-label="Fayl biriktirish"
          >
            <AttachFileIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <div className="flex-1 relative">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Suhbat tanlang' : placeholder}
            disabled={disabled}
            rows={1}
            className={`
              w-full resize-none rounded-xl px-3 py-2 text-sm leading-relaxed
              bg-gray-100 dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              border border-transparent
              focus:border-blue-500 focus:bg-white dark:focus:bg-gray-700
              focus:outline-none transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              scrollbar-thin
            `}
            style={{ minHeight: 40, maxHeight: 140 }}
          />
        </div>

        {!canSend && <VoiceButton disabled={disabled} onRecorded={onVoice} onError={onError} />}

        <AnimatePresence mode="wait">
          {canSend ? (
            <motion.div
              key="send"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={{    scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <IconButton
                onClick={handleSend}
                size="medium"
                sx={{
                  bgcolor: 'primary.main',
                  color:   'white',
                  mb: 0.5,
                  '&:hover': { bgcolor: 'primary.dark' },
                  transition: 'background-color 0.2s',
                }}
                aria-label="Xabarni yuborish"
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileChange}
        accept={ACCEPT}
      />
    </Paper>
  );
};

export default MessageComposer;
