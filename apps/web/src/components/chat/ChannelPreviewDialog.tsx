import React, { useState } from 'react';
import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import toast from 'react-hot-toast';
import type { PublicChannel } from '@suhbat/core';
import { api } from '../../services/api';
import { toChat } from '../../services/apiMappers';
import { upsertChat } from '../../features/chats/chatsSlice';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { errorText } from '../../utils/errors';

interface Props {
  channel:    PublicChannel | null;
  onClose:    () => void;
  /** Obuna bo'lingach yoki allaqachon a'zo bo'lsa — chat ochiladi. */
  onOpenChat: (chatId: string) => void;
}

/** Ochiq kanal ko'rinishi (qidiruvdan): nomi, tavsifi, obunachilar soni va "Obuna bo'lish". */
const ChannelPreviewDialog: React.FC<Props> = ({ channel, onClose, onOpenChat }) => {
  const dispatch = useAppDispatch();
  const me       = useAppSelector((s) => s.auth.user)!;
  const [busy, setBusy] = useState(false);

  const act = async () => {
    if (!channel) return;
    setBusy(true);
    try {
      if (!channel.isMember) {
        const chat = await api.joinChannel(channel.id);
        dispatch(upsertChat(toChat(chat, me.uid)));
      }
      onClose();
      onOpenChat(channel.id);
    } catch (e) {
      toast.error(errorText(e, 'Kanalga obuna bo\'lib bo\'lmadi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={channel !== null} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      {channel && (
        <>
          <DialogTitle className="flex items-center gap-3">
            <Avatar sx={{ bgcolor: 'secondary.main' }}><CampaignIcon /></Avatar>
            <Box className="min-w-0">
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>{channel.title}</Typography>
              <Typography variant="caption" color="text.secondary">{channel.memberCount} obunachi · ochiq kanal</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color={channel.description ? 'text.primary' : 'text.secondary'} sx={{ whiteSpace: 'pre-wrap' }}>
              {channel.description || 'Tavsif yo\'q.'}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>Yopish</Button>
            <Button variant="contained" onClick={() => void act()} disabled={busy} sx={{ textTransform: 'none' }}>
              {channel.isMember ? 'Ochish' : 'Obuna bo\'lish'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default ChannelPreviewDialog;
