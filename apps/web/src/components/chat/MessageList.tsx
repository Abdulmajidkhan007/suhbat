import React, { useEffect, useRef } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import SystemMessage from './SystemMessage';
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
  /** Birovning xabarini o'chirish huquqi (guruh/kanal owner/admini). */
  canModerate?: boolean;
  /** Yozish huquqi (kanalda oddiy a'zoda yo'q) — tahrirlash uchun ham kerak. */
  canWrite?:    boolean;
  onEdit?:      (messageId: string, content: string) => Promise<void>;
  onDelete?:    (messageId: string) => void;
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
  canModerate = false,
  canWrite = true,
  onEdit,
  onDelete,
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
          if (msg.type === 'system') return <SystemMessage key={msg.id} message={msg} />;
          const prevMsg = messages[idx - 1];
          const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId || prevMsg.type === 'system';
          const isSelf = msg.senderId === currentUserId;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={isSelf}
              showAvatar={showAvatar}
              canEdit={isSelf && canWrite && msg.type === 'text'}
              canDelete={isSelf || canModerate}
              onEdit={onEdit}
              onDelete={onDelete}
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
