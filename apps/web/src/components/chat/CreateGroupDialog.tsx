import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Typography, TextField, List, ListItem,
  ListItemButton, ListItemAvatar, ListItemText, Button,
  Chip, Box, CircularProgress, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import { motion, AnimatePresence } from 'framer-motion';
import SearchInput from '../common/SearchInput';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { searchUsers } from '../../services/userService';
import { createGroupChat } from '../../services/chatService';
import { AppUser } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { useEffect } from 'react';
import { useAppSelector } from '../../app/hooks';
import toast from 'react-hot-toast';

interface Props {
  open:          boolean;
  onClose:       () => void;
  onGroupCreated: (chatId: string) => void;
}

const CreateGroupDialog: React.FC<Props> = ({ open, onClose, onGroupCreated }) => {
  const currentUser    = useAppSelector((s) => s.auth.user)!;
  const [groupName, setGroupName]     = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<AppUser[]>([]);
  const [selected, setSelected]       = useState<AppUser[]>([]);
  const [searching, setSearching]     = useState(false);
  const [creating, setCreating]       = useState(false);
  const debouncedQuery                = useDebounce(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    searchUsers(debouncedQuery, currentUser.uid)
      .then((users) => { if (!cancelled) { setResults(users.filter((u) => !selected.find((s) => s.uid === u.uid))); setSearching(false); } })
      .catch(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, currentUser.uid, selected]);

  const toggleUser = (user: AppUser) => {
    setSelected((prev) =>
      prev.find((u) => u.uid === user.uid) ? prev.filter((u) => u.uid !== user.uid) : [...prev, user],
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { toast.error('Guruh nomini kiriting.'); return; }
    if (selected.length === 0) { toast.error('Kamida 1 ta a\'zo tanlang.'); return; }
    setCreating(true);
    try {
      const chatId = await createGroupChat(currentUser, selected, groupName.trim(), description.trim());
      onGroupCreated(chatId);
      onClose();
      resetState();
      toast.success(`"${groupName}" guruhi yaratildi!`);
    } catch {
      toast.error('Guruh yaratib bo\'lmadi.');
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setGroupName(''); setDescription(''); setQuery(''); setResults([]); setSelected([]);
  };

  const handleClose = () => { onClose(); resetState(); };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: '16px', maxHeight: '85vh' } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <GroupIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>Yangi guruh</Typography>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Guruh nomi *"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          fullWidth size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <TextField
          label="Tavsif (ixtiyoriy)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth size="small" multiline rows={2}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />

        {selected.length > 0 && (
          <Box className="flex flex-wrap gap-1">
            {selected.map((u) => (
              <Chip key={u.uid} label={u.displayName} size="small" onDelete={() => toggleUser(u)}
                avatar={<AvatarWithStatus uid={u.uid} displayName={u.displayName} photoURL={u.photoURL} showStatus={false} size={20} />}
                sx={{ borderRadius: '8px' }}
              />
            ))}
          </Box>
        )}

        <SearchInput value={query} onChange={setQuery} placeholder="A'zo qidirish..." />

        {searching && <Box className="flex justify-center py-2"><CircularProgress size={20} /></Box>}

        <List disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
          <AnimatePresence>
            {results.map((user, i) => (
              <motion.div key={user.uid} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => toggleUser(user)} selected={!!selected.find((s) => s.uid === user.uid)} sx={{ borderRadius: '10px', mb: 0.5 }}>
                    <ListItemAvatar sx={{ minWidth: 'auto', mr: 1.5 }}>
                      <AvatarWithStatus uid={user.uid} displayName={user.displayName} photoURL={user.photoURL} showStatus={false} size={36} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{user.displayName}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary">{user.email}</Typography>}
                    />
                  </ListItemButton>
                </ListItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </List>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', borderRadius: '10px' }}>Bekor</Button>
        <Button
          variant="contained" onClick={handleCreate} disabled={creating || !groupName.trim() || selected.length === 0}
          sx={{ textTransform: 'none', borderRadius: '10px', minWidth: 100 }}
        >
          {creating ? <CircularProgress size={18} color="inherit" /> : `Yaratish (${selected.length + 1})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog;
