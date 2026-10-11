import React, { memo } from 'react';
import { Typography, Box, Avatar } from '@mui/material';
import { motion } from 'framer-motion';
import GroupIcon from '@mui/icons-material/Group';
import CampaignIcon from '@mui/icons-material/Campaign';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { Chat } from '../../types';
import { formatChatTime, truncate } from '../../utils/formatters';

interface Props {
  chat:       Chat;
  isActive:   boolean;
  currentUid: string;
  isOnline:   boolean;
  onClick:    () => void;
}

const ChatListItem: React.FC<Props> = memo(({ chat, isActive, currentUid, isOnline, onClick }) => {
  const isGroup   = chat.type === 'group';
  const isChannel = chat.type === 'channel';
  const isDirect  = chat.type === 'direct';

  const otherParticipant = isDirect
    ? Object.values(chat.participantDetails).find((p) => p.uid !== currentUid)
    : null;

  const displayName = isDirect ? (otherParticipant?.displayName ?? chat.name) : chat.name;
  const displayUid  = isDirect ? (otherParticipant?.uid ?? chat.id) : chat.id;

  const lastMsg   = chat.lastMessage;
  const timeLabel = lastMsg ? formatChatTime(lastMsg.createdAt) : '';
  const preview   = lastMsg
    ? lastMsg.senderId === currentUid
      ? `Siz: ${lastMsg.content}`
      : lastMsg.content
    : 'Xabarlar yo\'q';

  const typingUserIds = Object.entries(chat.typingUsers ?? {})
    .filter(([uid, isTyping]) => isTyping && uid !== currentUid)
    .map(([uid]) => uid);

  const groupAvatar = (
    <Avatar
      sx={{
        width: 44,
        height: 44,
        bgcolor: isChannel ? 'secondary.main' : 'primary.main',
        flexShrink: 0,
      }}
    >
      {isChannel ? <CampaignIcon sx={{ fontSize: 22 }} /> : <GroupIcon sx={{ fontSize: 22 }} />}
    </Avatar>
  );

  const memberLabel = isGroup || isChannel
    ? `${chat.memberCount ?? chat.participants.length} a'zo`
    : null;

  return (
    <motion.button
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors
        ${isActive
          ? 'bg-blue-50 dark:bg-blue-950/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
      `}
      style={{ outline: 'none', border: 'none', background: isActive ? undefined : 'transparent', cursor: 'pointer' }}
      aria-selected={isActive}
    >
      {isDirect ? (
        <AvatarWithStatus
          uid={displayUid}
          displayName={displayName}
          photoURL={otherParticipant?.photoURL ?? null}
          isOnline={isOnline}
          size={44}
        />
      ) : groupAvatar}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <Typography
            variant="body2"
            noWrap
            sx={{ color: 'text.primary', fontSize: '0.875rem', fontWeight: chat.unreadCount > 0 ? 700 : 500 }}
          >
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0, fontSize: '0.7rem' }}>
            {timeLabel}
          </Typography>
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <Typography
            variant="caption"
            noWrap
            sx={{
              color:     typingUserIds.length > 0 ? 'primary.main' : 'text.secondary',
              fontStyle: typingUserIds.length > 0 ? 'italic' : 'normal',
              fontWeight: chat.unreadCount > 0 ? 600 : 400,
              fontSize:  '0.78rem',
            }}
          >
            {typingUserIds.length > 0
              ? 'yozmoqda…'
              : memberLabel && !lastMsg
              ? memberLabel
              : truncate(preview, 40)}
          </Typography>

          {chat.unreadCount > 0 && (
            <Box
              component="span"
              sx={{
                display:    'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor:    'primary.main',
                color:      'white',
                borderRadius: '50%',
                minWidth:   18,
                height:     18,
                fontSize:   '0.65rem',
                fontWeight: 700,
                px: 0.5,
                flexShrink: 0,
              }}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Box>
          )}
        </div>
      </div>
    </motion.button>
  );
});

ChatListItem.displayName = 'ChatListItem';
export default ChatListItem;
