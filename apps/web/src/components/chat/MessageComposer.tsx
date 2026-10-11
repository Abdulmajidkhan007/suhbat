import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IconButton, Tooltip, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceButton from './VoiceButton';
import AttachmentPreview from './AttachmentPreview';
import { useDebounce } from '../../hooks/useDebounce';
import { UploadProgress } from '../../types';

interface Props {
  onSend:       (content: string) => void;
  onTyping:     (isTyping: boolean) => void;
  onAttach?:    (file: File) => void;
  uploads?:     UploadProgress[];
  onRemoveUpload?: (id: string) => void;
  disabled?:    boolean;
  placeholder?: string;
}

const MessageComposer: React.FC<Props> = ({
  onSend,
  onTyping,
  onAttach,
  uploads = [],
  onRemoveUpload,
  disabled = false,
  placeholder = 'Type a message…',
}) => {
  const [text, setText]         = useState('');
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const textAreaRef             = useRef<HTMLTextAreaElement>(null);
  const debouncedText           = useDebounce(text, 800);
  const prevTypingRef           = useRef(false);

  useEffect(() => {
    const isTyping = debouncedText.length > 0;
    if (isTyping !== prevTypingRef.current) {
      prevTypingRef.current = isTyping;
      onTyping(isTyping);
    }
  }, [debouncedText, onTyping]);

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
    prevTypingRef.current = false;
  }, [text, disabled, onSend, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    e.target.value = '';
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <Paper
      elevation={0}
      className="border-t border-gray-100 dark:border-gray-800"
      sx={{ bgcolor: 'background.paper' }}
    >
      <AnimatePresence>
        {uploads.length > 0 && onRemoveUpload && (
          <AttachmentPreview uploads={uploads} onRemove={onRemoveUpload} />
        )}
      </AnimatePresence>

      <div className="flex items-end gap-1 px-3 py-2">
        <Tooltip title="Attach file">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            sx={{ color: 'text.secondary', mb: 0.5 }}
          >
            <AttachFileIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Emoji (coming soon)">
          <IconButton
            size="small"
            disabled={disabled}
            sx={{ color: 'text.secondary', mb: 0.5 }}
          >
            <EmojiEmotionsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <div className="flex-1 relative">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Select a conversation' : placeholder}
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

        <VoiceButton disabled={disabled || canSend} />

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
                aria-label="Send message"
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
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
    </Paper>
  );
};

export default MessageComposer;
