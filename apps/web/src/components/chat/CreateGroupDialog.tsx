import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import toast from 'react-hot-toast';
import { MAX_GROUP_MEMBERS } from '@suhbat/core';
import UserPicker from './UserPicker';
import { api } from '../../services/api';
import { toChat } from '../../services/apiMappers';
import { upsertChat } from '../../features/chats/chatsSlice';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { AppUser } from '../../types';
import { errorText } from '../../utils/errors';

interface Props {
  open:      boolean;
  onClose:   () => void;
  onCreated: (chatId: string) => void;
}

const CreateGroupDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const dispatch = useAppDispatch();
  const me       = useAppSelector((s) => s.auth.user)!;
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers]         = useState<AppUser[]>([]);
  const [saving, setSaving]           = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setMembers([]); };
  const close = () => { if (saving) return; reset(); onClose(); };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const chat = await api.createGroup({
        title:       title.trim(),
        description: description.trim() || undefined,
        memberIds:   members.map((m) => m.uid),
      });
      dispatch(upsertChat(toChat(chat, me.uid)));
      reset();
      onClose();
      onCreated(chat.id);
    } catch (e) {
      toast.error(errorText(e, 'Guruhni yaratib bo\'lmadi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Yangi guruh</DialogTitle>
      <DialogContent className="flex flex-col gap-3" sx={{ pt: '8px !important' }}>
        <TextField
          label="Guruh nomi"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 128 } }}
          size="small"
          autoFocus
          required
          fullWidth
        />
        <TextField
          label="Tavsif (ixtiyoriy)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 512 } }}
          size="small"
          multiline
          maxRows={3}
          fullWidth
        />
        <UserPicker selected={members} onChange={setMembers} />
        {members.length >= MAX_GROUP_MEMBERS - 1 && (
          <span className="text-xs text-red-500">Guruhda {MAX_GROUP_MEMBERS} tadan ortiq a'zo bo'lmaydi.</span>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={saving} sx={{ textTransform: 'none' }}>Bekor qilish</Button>
        <Button
          onClick={() => void submit()}
          variant="contained"
          disabled={!title.trim() || saving || members.length > MAX_GROUP_MEMBERS - 1}
          sx={{ textTransform: 'none' }}
        >
          Yaratish
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;
