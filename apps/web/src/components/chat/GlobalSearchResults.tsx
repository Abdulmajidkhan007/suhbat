import React from 'react';
import { Avatar, Box, CircularProgress, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import type { PublicChannel } from '@suhbat/core';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { AppUser } from '../../types';

interface Props {
  loading:       boolean;
  users:         AppUser[];
  channels:      PublicChannel[];
  usersError:    boolean;
  channelsError: boolean;
  /** Hozir chat ochilayotgan foydalanuvchi (qator o'chiriladi). */
  pendingUserId: string | null;
  onPickUser:    (user: AppUser) => void;
  onPickChannel: (channel: PublicChannel) => void;
  onRetry:       () => void;
}

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="overline"
    color="text.secondary"
    component="h3"
    sx={{ display: 'block', px: 1.5, pt: 1.5, pb: 0.25, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em' }}
  >
    {children}
  </Typography>
);

const SectionError: React.FC<{ text: string; onRetry: () => void }> = ({ text, onRetry }) => (
  <Box role="alert" className="flex items-center justify-between gap-2" sx={{ px: 1.5, py: 1 }}>
    <Typography variant="caption" color="error">{text}</Typography>
    <Typography
      variant="caption"
      component="button"
      onClick={onRetry}
      sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', background: 'none', border: 0, p: 0 }}
    >
      Qayta urinish
    </Typography>
  </Box>
);

/** Qidiruv natijasidagi "Foydalanuvchilar" va "Ochiq kanallar" bo'limlari. */
const GlobalSearchResults: React.FC<Props> = ({
  loading, users, channels, usersError, channelsError, pendingUserId, onPickUser, onPickChannel, onRetry,
}) => {
  if (loading) {
    return (
      <Box className="flex justify-center py-4" role="status" aria-label="Qidirilmoqda">
        <CircularProgress size={22} />
      </Box>
    );
  }

  return (
    <>
      {(users.length > 0 || usersError) && (
        <section aria-label="Foydalanuvchilar">
          <SectionTitle>Foydalanuvchilar</SectionTitle>
          {usersError && <SectionError text="Foydalanuvchilarni qidirib bo'lmadi." onRetry={onRetry} />}
          <List disablePadding>
            {users.map((u) => (
              <ListItemButton
                key={u.uid}
                onClick={() => onPickUser(u)}
                disabled={pendingUserId === u.uid}
                sx={{ borderRadius: '10px', gap: 1.5, px: 1.5, py: 1 }}
              >
                <ListItemAvatar sx={{ minWidth: 'auto' }}>
                  <AvatarWithStatus uid={u.uid} displayName={u.displayName} photoURL={u.photoURL} showStatus={false} size={40} />
                </ListItemAvatar>
                <ListItemText
                  primary={u.displayName}
                  secondary={u.bio || undefined}
                  slotProps={{ primary: { variant: 'body2', noWrap: true, sx: { fontWeight: 600 } }, secondary: { noWrap: true } }}
                />
                {pendingUserId === u.uid && <CircularProgress size={18} />}
              </ListItemButton>
            ))}
          </List>
        </section>
      )}

      {(channels.length > 0 || channelsError) && (
        <section aria-label="Ochiq kanallar">
          <SectionTitle>Ochiq kanallar</SectionTitle>
          {channelsError && <SectionError text="Kanallarni qidirib bo'lmadi." onRetry={onRetry} />}
          <List disablePadding>
            {channels.map((c) => (
              <ListItemButton key={c.id} onClick={() => onPickChannel(c)} sx={{ borderRadius: '10px', gap: 1.5, px: 1.5, py: 1 }}>
                <ListItemAvatar sx={{ minWidth: 'auto' }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}><CampaignIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={c.title}
                  secondary={`${c.memberCount} obunachi${c.description ? ` · ${c.description}` : ''}`}
                  slotProps={{ primary: { variant: 'body2', noWrap: true, sx: { fontWeight: 600 } }, secondary: { noWrap: true } }}
                />
              </ListItemButton>
            ))}
          </List>
        </section>
      )}
    </>
  );
};

export default GlobalSearchResults;
