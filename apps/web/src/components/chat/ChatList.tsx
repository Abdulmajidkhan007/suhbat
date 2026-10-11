import React, { useState, useMemo } from 'react';
import { Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import ChatListItem from './ChatListItem';
import SearchInput from '../common/SearchInput';
import { ChatListSkeleton } from '../ui/SkeletonLoader';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import { Chat } from '../../types';
import InboxIcon from '@mui/icons-material/Inbox';

interface Props {
  chats:        Chat[];
  activeChatId: string | null;
  currentUid:   string;
  loading:      boolean;
  error:        string | null;
  onlineUsers:  Record<string, boolean>;
  onSelectChat: (chatId: string) => void;
  onRetry?:     () => void;
}

const ChatList: React.FC<Props> = ({
  chats,
  activeChatId,
  currentUid,
  loading,
  error,
  onlineUsers,
  onSelectChat,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((c) => {
      const name = c.type === 'direct'
        ? Object.values(c.participantDetails).find((p) => p.uid !== currentUid)?.displayName ?? c.name
        : c.name;
      return name.toLowerCase().includes(q) || c.lastMessage?.content.toLowerCase().includes(q);
    });
  }, [chats, searchQuery, currentUid]);

  const getOnlineStatus = (chat: Chat): boolean => {
    if (chat.type !== 'direct') return false;
    const other = Object.values(chat.participantDetails).find((p) => p.uid !== currentUid);
    return other ? (onlineUsers[other.uid] ?? false) : false;
  };

  return (
    <Box className="flex flex-col h-full">
      <div className="px-3 py-2">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search conversations…" />
      </div>

      <Box className="flex-1 overflow-y-auto px-2 pb-2" sx={{ scrollbarWidth: 'thin' }}>
        {loading && <ChatListSkeleton count={7} />}

        {!loading && error && <ErrorState message={error} onRetry={onRetry} compact />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<InboxIcon sx={{ fontSize: 40 }} />}
            title={searchQuery ? 'No results' : 'No conversations'}
            description={searchQuery ? 'Try a different search.' : 'Start a new conversation.'}
          />
        )}

        {!loading && !error && (
          <AnimatePresence initial={false}>
            {filtered.map((chat, idx) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{    opacity: 0, x: -12 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
              >
                <ChatListItem
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  currentUid={currentUid}
                  isOnline={getOnlineStatus(chat)}
                  onClick={() => onSelectChat(chat.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </Box>
    </Box>
  );
};

export default ChatList;
