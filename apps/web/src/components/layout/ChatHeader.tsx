import React from 'react';
import { IconButton, Typography, Tooltip, Box, Avatar, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import GroupIcon from '@mui/icons-material/Group';
import CampaignIcon from '@mui/icons-material/Campaign';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AvatarWithStatus from '../common/AvatarWithStatus';
import StatusBadge from '../common/StatusBadge';
import type { CallMedia } from '@suhbat/core';
import { Chat } from '../../types';
import { subscriberCount } from '../../utils/members';

interface Props {
  chat:            Chat;
  currentUid:      string;
  isOnline:        boolean;
  /** Kichik ekranda: suhbatlar ro'yxatiga qaytish. */
  onBack?:         () => void;
  /** Guruh/kanal ma'lumotlari va boshqaruvi. */
  onOpenInfo?:     () => void;
  /** 1:1 chatda ovozli/video qo'ng'iroq. Berilmasa tugmalar yo'q. */
  onStartCall?:    (media: CallMedia) => void;
  /** Boshqa qo'ng'iroq davom etmoqda. */
  callDisabled?:   boolean;
}

const ChatHeader: React.FC<Props> = ({
  chat,
  currentUid,
  isOnline,
  onBack,
  onOpenInfo,
  onStartCall,
  callDisabled = false,
}) => {
  const isDirect  = chat.type === 'direct';
  const isChannel = chat.type === 'channel';

  const other       = isDirect ? Object.values(chat.participantDetails).find((p) => p.uid !== currentUid) : null;
  const displayName = isDirect ? (other?.displayName ?? chat.name) : chat.name;
  const displayUid  = isDirect ? (other?.uid ?? chat.id) : chat.id;

  const memberCount = chat.memberCount ?? chat.participants.length;
  const subscribers = subscriberCount(memberCount, Object.values(chat.participantDetails));

  return (
    <Box
      component="header"
      className="flex items-center gap-3 px-4 py-3 border-b"
      sx={{
        bgcolor:     'background.paper',
        borderColor: 'divider',
        minHeight:   64,
        flexShrink:  0,
      }}
    >
      {onBack && (
        <IconButton onClick={onBack} size="small" edge="start" aria-label="Orqaga">
          <ArrowBackIcon />
        </IconButton>
      )}

      {isDirect ? (
        <AvatarWithStatus
          uid={displayUid}
          displayName={displayName}
          photoURL={other?.photoURL ?? null}
          isOnline={isOnline}
          size={40}
        />
      ) : (
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: isChannel ? 'secondary.main' : 'primary.main',
            flexShrink: 0,
          }}
        >
          {isChannel ? <CampaignIcon sx={{ fontSize: 20 }} /> : <GroupIcon sx={{ fontSize: 20 }} />}
        </Avatar>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2, fontWeight: 600 }}>
            {displayName}
          </Typography>
          {isChannel && chat.isPublic && (
            <Chip label="Ochiq" size="small" sx={{ height: 18, fontSize: '0.65rem', borderRadius: '6px' }} />
          )}
        </div>
        {isDirect ? (
          <StatusBadge isOnline={isOnline} lastSeen={other?.lastSeen} size="small" />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            {isChannel ? `${subscribers} obunachi` : `${memberCount} a'zo`}
          </Typography>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {!isDirect && onOpenInfo && (
          <Tooltip title={isChannel ? 'Kanal haqida' : 'Guruh haqida'}>
            <IconButton size="small" onClick={onOpenInfo} sx={{ color: 'text.secondary' }} aria-label={isChannel ? 'Kanal haqida' : 'Guruh haqida'}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isDirect && onStartCall && (
          <>
            <Tooltip title="Ovozli qo'ng'iroq">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onStartCall('audio')}
                  disabled={callDisabled}
                  sx={{ color: 'text.secondary' }}
                  aria-label="Ovozli qo'ng'iroq"
                >
                  <CallOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Video qo'ng'iroq">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onStartCall('video')}
                  disabled={callDisabled}
                  sx={{ color: 'text.secondary' }}
                  aria-label="Video qo'ng'iroq"
                >
                  <VideocamOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      </div>
    </Box>
  );
};

export default ChatHeader;
