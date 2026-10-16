import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
  /** Tarixni qayta yuklash (yuklash xatosida). */
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
  /** Yuborilmagan xabarni qayta yuborish / ro'yxatdan olib tashlash. */
  onResend?:    (messageId: string) => void;
  onDiscard?:   (messageId: string) => void;
  /** Guruhda — yuboruvchi ismi va avatari; 1:1 va kanalda kerak emas. */
  showSenders?: boolean;
  /** "Javob berish" — yozish huquqi bo'lsa. */
  onReply?:     (message: Message) => void;
  /** Javob blokidagi muallif ismi. */
  nameOf?:      (userId: string) => string;
}

const HIGHLIGHT_MS = 1500;

/** Bo'sh/yuklanish/xato holati maydonni to'ldiradi — composer doim pastda turadi. */
const Fill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center">{children}</Box>
);

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
  onResend,
  onDiscard,
  showSenders = true,
  onReply,
  nameOf,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  /** Asl xabar sahifada bo'lsa — unga o'tib, qisqa yoritiladi; bo'lmasa — izoh. */
  const jumpTo = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      toast('Asl xabar hali yuklanmagan — "Eskiroq xabarlar"ni bosing.');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(highlightTimer.current);
    setHighlightId(messageId);
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }, []);
  const lastId    = messages[messages.length - 1]?.id;

  // Faqat yangi xabar (oxirgisi o'zgarsa) yoki "yozmoqda"da pastga; eskilar
  // yuqoridan qo'shilganda joy saqlanadi.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastId, typingNames.length]);

  if (loading) return <Fill><MessageSkeleton count={6} /></Fill>;
  if (error)   return <Fill><ErrorState message={error} onRetry={onRetry} /></Fill>;

  if (messages.length === 0) {
    return (
      <Fill>
        <EmptyState
          icon={<ChatBubbleOutlineIcon sx={{ fontSize: 48 }} />}
          title="Hali xabar yo'q"
          description="Birinchi bo'lib yozing!"
        />
      </Fill>
    );
  }

  return (
    <Box
      component="div"
      role="log"
      aria-label="Xabarlar"
      className="flex flex-col flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-4 gap-1 scroll-smooth"
      sx={{ scrollbarWidth: 'thin', '&::-webkit-scrollbar': { width: '4px' } }}
    >
      {hasOlder && onLoadOlder && (
        <Box className="flex justify-center pb-2">
          <Button size="small" onClick={onLoadOlder} disabled={loadingOlder} sx={{ textTransform: 'none' }}>
            {loadingOlder ? <CircularProgress size={16} aria-label="Yuklanmoqda" /> : 'Eskiroq xabarlar'}
          </Button>
        </Box>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          if (msg.type === 'system') return <SystemMessage key={msg.id} message={msg} />;
          const prevMsg = messages[idx - 1];
          const firstOfGroup = !prevMsg || prevMsg.senderId !== msg.senderId || prevMsg.type === 'system';
          const isSelf = msg.senderId === currentUserId;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={isSelf}
              showSender={showSenders}
              showAvatar={firstOfGroup}
              canEdit={isSelf && canWrite && msg.type === 'text'}
              canDelete={isSelf || canModerate}
              onEdit={onEdit}
              onDelete={onDelete}
              onResend={onResend}
              onDiscard={onDiscard}
              onReply={onReply}
              replyName={msg.replyTo ? (msg.replyTo.senderId === currentUserId ? 'Siz' : nameOf?.(msg.replyTo.senderId)) : undefined}
              onJump={jumpTo}
              highlighted={highlightId === msg.id}
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
