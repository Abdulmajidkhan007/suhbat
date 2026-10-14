import React from 'react';
import { Box, Dialog, IconButton, Stack, Typography } from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VideocamIcon from '@mui/icons-material/Videocam';
import type { CallPeer } from '@suhbat/client';
import type { CallMedia } from '@suhbat/core';
import AvatarWithStatus from '../common/AvatarWithStatus';

interface Props {
  open:     boolean;
  peer:     CallPeer;
  media:    CallMedia;
  onAccept: () => void;
  onReject: () => void;
}

/** Kiruvchi qo'ng'iroq: qabul qilish yoki rad etish. */
const IncomingCallDialog: React.FC<Props> = ({ open, peer, media, onAccept, onReject }) => (
  <Dialog
    open={open}
    maxWidth="xs"
    fullWidth
    aria-labelledby="incoming-call-title"
    slotProps={{ paper: { sx: { borderRadius: '24px', m: 2 } } }}
  >
    <Stack spacing={2} sx={{ alignItems: 'center', px: 3, pt: 4, pb: 3 }}>
      <Box className="animate-pulse">
        <AvatarWithStatus uid={peer.id} displayName={peer.displayName} photoURL={peer.photoUrl} showStatus={false} size={88} />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography id="incoming-call-title" variant="h6" noWrap sx={{ fontWeight: 700, maxWidth: 280 }}>
          {peer.displayName}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {media === 'video' ? 'Kiruvchi video qo\'ng\'iroq' : 'Kiruvchi qo\'ng\'iroq'}
        </Typography>
      </Box>
      <Stack direction="row" spacing={6} sx={{ pt: 1 }}>
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <IconButton
            onClick={onReject}
            aria-label="Rad etish"
            sx={{ width: 60, height: 60, bgcolor: 'error.main', color: 'common.white', '&:hover': { bgcolor: 'error.dark' } }}
          >
            <CallEndIcon />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Rad etish</Typography>
        </Stack>
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
          <IconButton
            onClick={onAccept}
            aria-label="Qabul qilish"
            sx={{ width: 60, height: 60, bgcolor: 'success.main', color: 'common.white', '&:hover': { bgcolor: 'success.dark' } }}
          >
            {media === 'video' ? <VideocamIcon /> : <CallIcon />}
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Qabul qilish</Typography>
        </Stack>
      </Stack>
    </Stack>
  </Dialog>
);

export default IncomingCallDialog;
