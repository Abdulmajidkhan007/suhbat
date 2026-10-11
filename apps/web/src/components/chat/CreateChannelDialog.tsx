import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Typography, TextField, Button, Switch,
  FormControlLabel, Divider, CircularProgress, Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useAppSelector } from '../../app/hooks';
import { createChannel } from '../../services/chatService';
import toast from 'react-hot-toast';

interface Props {
  open:            boolean;
  onClose:         () => void;
  onChannelCreated: (chatId: string) => void;
}

const CreateChannelDialog: React.FC<Props> = ({ open, onClose, onChannelCreated }) => {
  const currentUser              = useAppSelector((s) => s.auth.user)!;
  const [name, setName]          = useState('');
  const [description, setDesc]   = useState('');
  const [isPublic, setIsPublic]  = useState(true);
  const [creating, setCreating]  = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Kanal nomini kiriting.'); return; }
    setCreating(true);
    try {
      const chatId = await createChannel(currentUser, name.trim(), description.trim(), isPublic);
      onChannelCreated(chatId);
      onClose();
      setName(''); setDesc(''); setIsPublic(true);
      toast.success(`"${name}" kanali yaratildi!`);
    } catch {
      toast.error('Kanal yaratib bo\'lmadi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <CampaignIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>Yangi kanal</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Kanal nomi *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <TextField
          label="Tavsif (ixtiyoriy)"
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          fullWidth size="small" multiline rows={3}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <Box sx={{ bgcolor: 'action.hover', borderRadius: '12px', px: 2, py: 1 }}>
          <FormControlLabel
            control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
            label={
              <div>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {isPublic ? 'Ochiq kanal' : 'Yopiq kanal'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isPublic ? 'Har kim topib qo\'shila oladi' : 'Faqat taklif orqali kirish'}
                </Typography>
              </div>
            }
            labelPlacement="start"
            sx={{ width: '100%', justifyContent: 'space-between', mx: 0 }}
          />
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: '10px' }}>Bekor</Button>
        <Button variant="contained" onClick={handleCreate} disabled={creating || !name.trim()}
          sx={{ textTransform: 'none', borderRadius: '10px', minWidth: 100 }}>
          {creating ? <CircularProgress size={18} color="inherit" /> : 'Yaratish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateChannelDialog;
