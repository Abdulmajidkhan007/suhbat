import React from 'react';
import { IconButton, Typography, Tooltip, Box, Avatar, Chip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import GroupIcon from '@mui/icons-material/Group';
import CampaignIcon from '@mui/icons-material/Campaign';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import AvatarWithStatus from '../common/AvatarWithStatus';
import StatusBadge from '../common/StatusBadge';
import { Chat } from '../../types';

interface Props {
  chat:            Chat;
  currentUid:      string;
  isOnline:        boolean;
  onMenuClick:     () => void;
  showMenuButton:  boolean;
  onAddMember?:    () => void;
}

const ChatHeader: React.FC<Props> = ({
  chat,
  currentUid,
  isOnline,
  onMenuClick,
  showMenuButton,
  onAddMember,
}) => {
  const isDirect  = chat.type === 'direct';
  const isChannel = chat.type === 'channel';

  const other       = isDirect ? Object.values(chat.participantDetails).find((p) => p.uid !== currentUid) : null;
  const displayName = isDirect ? (other?.displayName ?? chat.name) : chat.name;
  const displayUid  = isDirect ? (other?.uid ?? chat.id) : chat.id;

  const memberCount = chat.memberCount ?? chat.participants.length;
  const canAddMember =
    !isDirect &&
    (chat.ownerId === currentUid || (chat.admins ?? []).includes(currentUid));

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
      {showMenuButton && (
        <IconButton onClick={onMenuClick} size="small" edge="start" aria-label="Open sidebar">
          <MenuIcon />
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
          <StatusBadge isOnline={isOnline} size="small" />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            {memberCount} {isChannel ? 'obunachi' : 'a\'zo'}
          </Typography>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {canAddMember && onAddMember && (
          <Tooltip title={isChannel ? 'Obunachi qo\'shish' : 'A\'zo qo\'shish'}>
            <IconButton size="small" onClick={onAddMember} sx={{ color: 'primary.main' }}>
              <PersonAddOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isDirect && (
          <>
            <Tooltip title="Ovozli qo'ng'iroq (tez kunda)">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <CallOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Video qo'ng'iroq (tez kunda)">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <VideocamOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="Ko'proq">
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    </Box>
  );
};

export default ChatHeader;
