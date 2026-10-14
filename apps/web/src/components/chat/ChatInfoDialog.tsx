import React, { useEffect, useState } from 'react';
import {
  Avatar, Box, Button, Chip, Dialog, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, List, ListItem,
  ListItemText, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import GroupIcon from '@mui/icons-material/Group';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import toast from 'react-hot-toast';
import { canManage, canRemove } from '@suhbat/core';
import UserPicker from './UserPicker';
import ConfirmDialog from '../common/ConfirmDialog';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { api } from '../../services/api';
import { toChat } from '../../services/apiMappers';
import { clearMessages } from '../../features/messages/messagesSlice';
import { removeChat, upsertChat } from '../../features/chats/chatsSlice';
import { fetchChat } from '../../features/realtime/realtimeThunks';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { AppUser, Chat, UserRole } from '../../types';
import { errorText } from '../../utils/errors';
import { listedMembers, subscriberCount } from '../../utils/members';

interface Props {
  chat:    Chat;
  open:    boolean;
  onClose: () => void;
  /** Chatdan chiqildi yoki o'chirildi — ro'yxat/yo'nalish yangilanadi. */
  onLeft:  () => void;
}

const ROLE_LABEL: Record<UserRole, string> = { owner: 'Ega', admin: 'Admin', member: 'A\'zo' };

type Confirm = 'leave' | 'delete' | null;

const ChatInfoDialog: React.FC<Props> = ({ chat, open, onClose, onLeft }) => {
  const dispatch = useAppDispatch();
  const me       = useAppSelector((s) => s.auth.user)!;
  const isChannel = chat.type === 'channel';
  const manage    = canManage(chat.type, chat.myRole);
  const isOwner   = chat.myRole === 'owner';

  const [title, setTitle]             = useState(chat.name);
  const [description, setDescription] = useState(chat.description ?? '');
  const [isPublic, setIsPublic]       = useState(chat.isPublic ?? false);
  const [adding, setAdding]           = useState<AppUser[]>([]);
  const [busy, setBusy]               = useState(false);
  const [confirm, setConfirm]         = useState<Confirm>(null);

  // Dialog ochilganda yoki server yangilaganda (chat:updated) maydonlar tiklanadi.
  useEffect(() => {
    if (!open) return;
    setTitle(chat.name);
    setDescription(chat.description ?? '');
    setIsPublic(chat.isPublic ?? false);
    setAdding([]);
  }, [open, chat.name, chat.description, chat.isPublic]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    title.trim() !== chat.name ||
    description.trim() !== (chat.description ?? '') ||
    (isChannel && isPublic !== (chat.isPublic ?? false));

  const save = () => run(async () => {
    const updated = await api.updateChat(chat.id, {
      title:       title.trim() !== chat.name ? title.trim() : undefined,
      description: description.trim() !== (chat.description ?? '') ? description.trim() : undefined,
      isPublic:    isChannel && isPublic !== (chat.isPublic ?? false) ? isPublic : undefined,
    });
    dispatch(upsertChat(toChat(updated, me.uid)));
    toast.success('Saqlandi');
  }, 'Saqlab bo\'lmadi.');

  const addMembers = () => run(async () => {
    const updated = await api.addMembers(chat.id, adding.map((u) => u.uid));
    dispatch(upsertChat(toChat(updated, me.uid)));
    setAdding([]);
  }, 'A\'zolarni qo\'shib bo\'lmadi.');

  const remove = (uid: string) => run(async () => {
    await api.removeMember(chat.id, uid);
    await dispatch(fetchChat(chat.id));
  }, 'A\'zoni chiqarib bo\'lmadi.');

  const toggleAdmin = (uid: string, role: UserRole) => run(async () => {
    await api.setMemberRole(chat.id, uid, role === 'admin' ? 'member' : 'admin');
    await dispatch(fetchChat(chat.id));
  }, 'Rolni o\'zgartirib bo\'lmadi.');

  const leaveOrDelete = () => run(async () => {
    if (confirm === 'delete') await api.deleteChat(chat.id);
    else await api.leaveChat(chat.id);
    dispatch(removeChat(chat.id));
    dispatch(clearMessages(chat.id));
    setConfirm(null);
    onClose();
    onLeft();
  }, confirm === 'delete' ? 'Chatni o\'chirib bo\'lmadi.' : 'Chatdan chiqib bo\'lmadi.');

  const allMembers  = Object.values(chat.participantDetails);
  const members     = listedMembers(chat.type, allMembers);
  const memberCount = chat.memberCount ?? allMembers.length;
  const subscribers = subscriberCount(memberCount, allMembers);

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" scroll="paper" slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
        <DialogTitle className="flex items-center gap-3">
          <Avatar sx={{ bgcolor: isChannel ? 'secondary.main' : 'primary.main' }}>
            {isChannel ? <CampaignIcon /> : <GroupIcon />}
          </Avatar>
          <Box className="min-w-0">
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>{chat.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {isChannel ? `${subscribers} obunachi` : `${memberCount} a'zo`}{isChannel && chat.isPublic ? ' · ochiq kanal' : ''}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers className="flex flex-col gap-3">
          {manage ? (
            <>
              <TextField label="Nomi" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 128 } }} />
              <TextField label="Tavsif" size="small" fullWidth multiline maxRows={4} value={description} onChange={(e) => setDescription(e.target.value)} slotProps={{ htmlInput: { maxLength: 512 } }} />
              {isChannel && (
                <FormControlLabel control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />} label="Ochiq kanal" />
              )}
              <Box className="flex justify-end">
                <Button variant="contained" size="small" disabled={!dirty || !title.trim() || busy} onClick={() => void save()} sx={{ textTransform: 'none' }}>
                  Saqlash
                </Button>
              </Box>
            </>
          ) : (
            chat.description && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{chat.description}</Typography>
          )}

          <Divider />
          <Typography variant="overline" color="text.secondary">
            {isChannel ? 'Ega va adminlar' : 'A\'zolar'}
          </Typography>
          <List disablePadding>
            {members.map((m) => {
              const role = m.role ?? 'member';
              const canToggleAdmin = isOwner && role !== 'owner';
              const canKick = m.uid !== me.uid && canRemove(chat.myRole, role);
              return (
                <ListItem
                  key={m.uid}
                  disableGutters
                  className="gap-3"
                  sx={{ pr: (canToggleAdmin ? 4.5 : 0) + (canKick ? 4.5 : 0) }}
                  secondaryAction={!canToggleAdmin && !canKick ? undefined : (
                    <Box className="flex items-center">
                      {canToggleAdmin && (
                        <Tooltip title={role === 'admin' ? 'Adminlikni olib tashlash' : 'Admin qilish'}>
                          <span>
                            <IconButton size="small" disabled={busy} onClick={() => void toggleAdmin(m.uid, role)} aria-label={role === 'admin' ? 'Adminlikni olib tashlash' : 'Admin qilish'}>
                              <AdminPanelSettingsOutlinedIcon fontSize="small" color={role === 'admin' ? 'primary' : 'inherit'} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canKick && (
                        <Tooltip title="Chiqarish">
                          <span>
                            <IconButton size="small" disabled={busy} onClick={() => void remove(m.uid)} aria-label={`${m.displayName} ni chiqarish`}>
                              <PersonRemoveOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                >
                  <AvatarWithStatus uid={m.uid} displayName={m.displayName} photoURL={m.photoURL} showStatus={false} size={34} />
                  <ListItemText
                    primary={<>{m.displayName}{m.uid === me.uid ? ' (siz)' : ''}</>}
                    slotProps={{ primary: { variant: 'body2', noWrap: true, sx: { fontWeight: 600 } } }}
                  />
                  {role !== 'member' && <Chip label={ROLE_LABEL[role]} size="small" color={role === 'owner' ? 'primary' : 'default'} />}
                </ListItem>
              );
            })}
          </List>

          {manage && (
            <>
              <Divider />
              <Typography variant="overline" color="text.secondary">{isChannel ? 'Obunachi qo\'shish' : 'A\'zo qo\'shish'}</Typography>
              <UserPicker selected={adding} onChange={setAdding} excludeIds={chat.participants} maxHeight={160} />
              <Box className="flex justify-end">
                <Button variant="contained" size="small" disabled={adding.length === 0 || busy} onClick={() => void addMembers()} sx={{ textTransform: 'none' }}>
                  Qo'shish{adding.length > 0 ? ` (${adding.length})` : ''}
                </Button>
              </Box>
            </>
          )}

          <Divider />
          {isOwner ? (
            <Button color="error" onClick={() => setConfirm('delete')} disabled={busy} sx={{ textTransform: 'none' }}>
              {isChannel ? 'Kanalni o\'chirish' : 'Guruhni o\'chirish'}
            </Button>
          ) : (
            <Button color="error" onClick={() => setConfirm('leave')} disabled={busy} sx={{ textTransform: 'none' }}>
              {isChannel ? 'Obunadan chiqish' : 'Guruhdan chiqish'}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        destructive
        loading={busy}
        title={confirm === 'delete' ? `"${chat.name}" o'chirilsinmi?` : `"${chat.name}" dan chiqasizmi?`}
        description={confirm === 'delete'
          ? 'Barcha xabarlar va fayllar hamma uchun o\'chadi. Buni qaytarib bo\'lmaydi.'
          : 'Yana qo\'shilish uchun taklif yoki (ochiq kanalda) obuna kerak bo\'ladi.'}
        confirmLabel={confirm === 'delete' ? 'O\'chirish' : 'Chiqish'}
        onConfirm={() => void leaveOrDelete()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
};

export default ChatInfoDialog;
