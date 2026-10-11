import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Typography, List, ListItem, ListItemButton,
  ListItemAvatar, ListItemText, Button, Chip, Box,
  CircularProgress, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import SearchInput from '../common/SearchInput';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { searchUsers } from '../../services/userService';
import { addMembersToGroup } from '../../services/chatService';
import { AppUser, Chat } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { useAppSelector } from '../../app/hooks';
import toast from 'react-hot-toast';

interface Props {
  open:    boolean;
  onClose: () => void;
  chat:    Chat;
}

const AddMemberDialog: React.FC<Props> = ({ open, onClose, chat }) => {
  const currentUser               = useAppSelector((s) => s.auth.user)!;
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<AppUser[]>([]);
  const [selected, setSelected]   = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding]       = useState(false);
  const debouncedQuery            = useDebounce(query, 400);

  const existingIds = new Set(chat.participants);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSelected([]); }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    searchUsers(debouncedQuery, currentUser.uid)
      .then((users) => {
        if (!cancelled) {
          setResults(
            users.filter(
              (u) => !existingIds.has(u.uid) && !selected.find((s) => s.uid === u.uid),
            ),
          );
          setSearching(false);
        }
      })
      .catch(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, currentUser.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUser = (user: AppUser) => {
    setSelected((prev) =>
      prev.find((u) => u.uid === user.uid)
        ? prev.filter((u) => u.uid !== user.uid)
        : [...prev, user],
    );
  };

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setAdding(true);
    try {
      await addMembersToGroup(chat.id, selected);
      toast.success(`${selected.length} ta a'zo qo'shildi!`);
      onClose();
    } catch {
      toast.error('A\'zo qo\'shib bo\'lmadi.');
    } finally {
      setAdding(false);
    }
  };

  const isChannel = chat.type === 'channel';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: '16px', maxHeight: '85vh' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <PersonAddOutlinedIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {isChannel ? 'Kanalga a\'zo qo\'shish' : 'Guruhga a\'zo qo\'shish'}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {selected.length > 0 && (
          <Box className="flex flex-wrap gap-1">
            {selected.map((u) => (
              <Chip
                key={u.uid}
                label={u.displayName}
                size="small"
                onDelete={() => toggleUser(u)}
                avatar={
                  <AvatarWithStatus
                    uid={u.uid}
                    displayName={u.displayName}
                    photoURL={u.photoURL}
                    showStatus={false}
                    size={20}
                  />
                }
                sx={{ borderRadius: '8px' }}
              />
            ))}
          </Box>
        )}

        <SearchInput value={query} onChange={setQuery} placeholder="Foydalanuvchi qidirish..." />

        {searching && (
          <Box className="flex justify-center py-2">
            <CircularProgress size={20} />
          </Box>
        )}

        {!searching && query.trim().length > 0 && results.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
            Foydalanuvchi topilmadi
          </Typography>
        )}

        <List disablePadding sx={{ maxHeight: 240, overflow: 'auto' }}>
          <AnimatePresence>
            {results.map((user, i) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleUser(user)}
                    selected={!!selected.find((s) => s.uid === user.uid)}
                    sx={{ borderRadius: '10px', mb: 0.5 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 'auto', mr: 1.5 }}>
                      <AvatarWithStatus
                        uid={user.uid}
                        displayName={user.displayName}
                        photoURL={user.photoURL}
                        showStatus={false}
                        size={36}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {user.displayName}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      }
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
        <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: '10px' }}>
          Bekor
        </Button>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={adding || selected.length === 0}
          sx={{ textTransform: 'none', borderRadius: '10px', minWidth: 100 }}
        >
          {adding
            ? <CircularProgress size={18} color="inherit" />
            : `Qo'shish (${selected.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMemberDialog;
