import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { toChat } from '../../services/apiMappers';
import { upsertChat } from '../../features/chats/chatsSlice';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { errorText } from '../../utils/errors';

interface Props {
  open:      boolean;
  onClose:   () => void;
  onCreated: (chatId: string) => void;
}

const CreateChannelDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const dispatch = useAppDispatch();
  const me       = useAppSelector((s) => s.auth.user)!;
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic]       = useState(true);
  const [saving, setSaving]           = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setIsPublic(true); };
  const close = () => { if (saving) return; reset(); onClose(); };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const chat = await api.createChannel({ title: title.trim(), description: description.trim() || undefined, isPublic });
      dispatch(upsertChat(toChat(chat, me.uid)));
      reset();
      onClose();
      onCreated(chat.id);
    } catch (e) {
      toast.error(errorText(e, 'Kanalni yaratib bo\'lmadi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Yangi kanal</DialogTitle>
      <DialogContent className="flex flex-col gap-3" sx={{ pt: '8px !important' }}>
        <TextField
          label="Kanal nomi"
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
        <div>
          <FormControlLabel
            control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
            label="Ochiq kanal"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
            {isPublic
              ? 'Hamma qidirib topadi va obuna bo\'la oladi.'
              : 'Faqat siz qo\'shgan odamlar ko\'radi.'}
            {' '}Kanalda faqat siz va adminlar yozadi.
          </Typography>
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={saving} sx={{ textTransform: 'none' }}>Bekor qilish</Button>
        <Button onClick={() => void submit()} variant="contained" disabled={!title.trim() || saving} sx={{ textTransform: 'none' }}>
          Yaratish
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateChannelDialog;
