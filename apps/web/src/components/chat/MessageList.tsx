import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
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
}

const MessageList: React.FC<Props> = ({
  messages,
  currentUserId,
  loading,
  error,
  typingNames,
  onRetry,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingNames.length]);

  if (loading) return <MessageSkeleton count={6} />;
  if (error)   return <ErrorState message={error} onRetry={onRetry} />;

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<ChatBubbleOutlineIcon sx={{ fontSize: 48 }} />}
        title="No messages yet"
        description="Be the first to say something!"
      />
    );
  }

  return (
    <Box
      component="div"
      className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-1 scroll-smooth"
      sx={{ scrollbarWidth: 'thin', '&::-webkit-scrollbar': { width: '4px' } }}
    >
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
