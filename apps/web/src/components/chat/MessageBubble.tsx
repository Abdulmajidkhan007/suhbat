import React, { memo } from 'react';
import { Typography, Tooltip } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { motion } from 'framer-motion';
import { Message } from '../../types';
import { formatMessageTime } from '../../utils/formatters';
import FileChip from '../common/FileChip';
import AvatarWithStatus from '../common/AvatarWithStatus';

interface Props {
  message:    Message;
  isSelf:     boolean;
  isFirst?:   boolean;
  showAvatar?: boolean;
}

const StatusIcon: React.FC<{ status: Message['status'] }> = ({ status }) => {
  if (status === 'sending')   return <DoneIcon sx={{ fontSize: 12, opacity: 0.5 }} />;
  if (status === 'sent')      return <DoneIcon sx={{ fontSize: 12, color: 'text.secondary' }} />;
  if (status === 'delivered') return <DoneAllIcon sx={{ fontSize: 12, color: 'text.secondary' }} />;
  if (status === 'read')      return <DoneAllIcon sx={{ fontSize: 12, color: '#60a5fa' }} />;
  if (status === 'failed')    return <span className="text-red-400 text-xs">!</span>;
  return null;
};

const MessageBubble: React.FC<Props> = memo(({ message, isSelf, showAvatar = true }) => {
  const isImage = message.type === 'image' && message.attachment;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-end gap-2 max-w-[78%] ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
    >
      {!isSelf && showAvatar ? (
        <AvatarWithStatus
          uid={message.senderId}
          displayName={message.senderName}
          photoURL={message.senderPhoto}
          showStatus={false}
          size={30}
        />
      ) : (
        !isSelf && <div className="w-[30px] flex-shrink-0" />
      )}

      <div className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
        {!isSelf && showAvatar && (
          <Typography variant="caption" sx={{ px: 1, fontWeight: 600, color: 'text.secondary' }}>
            {message.senderName}
          </Typography>
        )}

        <Tooltip
          title={formatMessageTime(message.createdAt)}
          placement={isSelf ? 'left' : 'right'}
          arrow
        >
          <div
            className={`relative px-3 py-2 rounded-2xl max-w-full break-words ${
              isSelf
                ? 'rounded-br-sm bg-blue-600 text-white'
                : 'rounded-bl-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-soft'
            } ${message.isOptimistic ? 'opacity-70' : ''}`}
            style={{ minWidth: 60 }}
          >
            {isImage && message.attachment ? (
              <img
                src={message.attachment.url}
                alt={message.attachment.name}
                className="max-w-[240px] max-h-[200px] rounded-xl object-cover"
                loading="lazy"
              />
            ) : message.attachment ? (
              <FileChip attachment={message.attachment} onClick={() => window.open(message.attachment!.url, '_blank')} />
            ) : (
              <Typography variant="body2" sx={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
                {message.content}
              </Typography>
            )}

            {isSelf && (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7 }}>
                  {formatMessageTime(message.createdAt)}
                </Typography>
                <StatusIcon status={message.status} />
              </div>
            )}
            {!isSelf && (
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', fontSize: '0.65rem', opacity: 0.5, mt: 0.25 }}>
                {formatMessageTime(message.createdAt)}
              </Typography>
            )}
          </div>
        </Tooltip>
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
