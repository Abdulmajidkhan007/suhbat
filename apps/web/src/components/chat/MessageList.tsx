import React, { useEffect, useRef } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { MessageSkeleton } from '../ui/SkeletonLoader';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import TypingIndicator from './TypingIndicator';
import { Message } from '../../types';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';

interface Props {
  messages:     Message[];
  currentUserId: string;
  loading:      boolean;
  error:        string | null;
  typingNames:  string[];
  onRetry?:     () => void;
  hasOlder?:    boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}

const MessageList: React.FC<Props> = ({
  messages,
  currentUserId,
  loading,
  error,
  typingNames,
  onRetry,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId    = messages[messages.length - 1]?.id;

  // Faqat yangi xabar (oxirgisi o'zgarsa) yoki "yozmoqda"da pastga; eskilar
  // yuqoridan qo'shilganda joy saqlanadi.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastId, typingNames.length]);

  if (loading) return <MessageSkeleton count={6} />;
  if (error)   return <ErrorState message={error} onRetry={onRetry} />;

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<ChatBubbleOutlineIcon sx={{ fontSize: 48 }} />}
        title="Hali xabar yo'q"
        description="Birinchi bo'lib yozing!"
      />
    );
  }

  return (
    <Box
      component="div"
      className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-1 scroll-smooth"
      sx={{ scrollbarWidth: 'thin', '&::-webkit-scrollbar': { width: '4px' } }}
    >
      {hasOlder && onLoadOlder && (
        <Box className="flex justify-center pb-2">
          <Button size="small" onClick={onLoadOlder} disabled={loadingOlder} sx={{ textTransform: 'none' }}>
            {loadingOlder ? <CircularProgress size={16} /> : 'Eskiroq xabarlar'}
          </Button>
        </Box>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === currentUserId}
              showAvatar={showAvatar}
            />
          );
        })}
      </AnimatePresence>

      <TypingIndicator typingNames={typingNames} />
      <div ref={bottomRef} />
    </Box>
  );
};

export default MessageList;
