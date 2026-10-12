import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  CircularProgress,
  Box,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import SearchInput from '../common/SearchInput';
import AvatarWithStatus from '../common/AvatarWithStatus';
import EmptyState from '../ui/EmptyState';
import { api } from '../../services/api';
import { toAppUser, toChat } from '../../services/apiMappers';
import { upsertChat } from '../../features/chats/chatsSlice';
import { AppUser } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import toast from 'react-hot-toast';

interface Props {
  open:      boolean;
  onClose:   () => void;
  onChatCreated: (chatId: string) => void;
}

const NewChatDialog: React.FC<Props> = ({ open, onClose, onChatCreated }) => {
  const dispatch      = useAppDispatch();
  const currentUser   = useAppSelector((s) => s.auth.user)!;
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.searchUsers(debouncedQuery.trim())
      .then((users) => { if (!cancelled) { setResults(users.map(toAppUser)); setLoading(false); } })
      .catch(() => { if (!cancelled) { setResults([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleSelect = useCallback(async (user: AppUser) => {
    setCreating(user.uid);
    try {
      const chat = await api.createDirectChat(user.uid);
      dispatch(upsertChat(toChat(chat, currentUser.uid)));
      onChatCreated(chat.id);
      onClose();
      setQuery('');
      setResults([]);
    } catch {
      toast.error('Suhbatni boshlab bo\'lmadi. Qayta urinib ko\'ring.');
    } finally {
      setCreating(null);
    }
  }, [currentUser.uid, dispatch, onChatCreated, onClose]);

  const handleClose = () => {
    onClose();
    setQuery('');
    setResults([]);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '16px',
            overflow:     'hidden',
            maxHeight:    '80vh',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
          Yangi suhbat
        </Typography>
        <IconButton size="small" onClick={handleClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Ism yoki email bo'yicha qidiring…"
        />
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {loading && (
          <Box className="flex justify-center py-6">
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && query.trim().length > 0 && results.length === 0 && (
          <EmptyState
            icon={<PersonAddOutlinedIcon sx={{ fontSize: 36 }} />}
            title="Hech kim topilmadi"
            description="Boshqa ism yoki email bilan urinib ko'ring."
          />
        )}

        {!loading && query.trim().length === 0 && (
          <Box className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
            <PersonAddOutlinedIcon sx={{ fontSize: 40, opacity: 0.3 }} />
            <Typography variant="body2" color="text.secondary">
              Suhbat boshlash uchun odamni qidiring
            </Typography>
          </Box>
        )}

        <AnimatePresence>
          {results.length > 0 && (
            <List disablePadding>
              {results.map((user, idx) => (
                <motion.div
                  key={user.uid}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                >
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleSelect(user)}
                      disabled={creating === user.uid}
                      sx={{ px: 2, py: 1.25, gap: 1.5 }}
                    >
                      <ListItemAvatar sx={{ minWidth: 'auto' }}>
                        <AvatarWithStatus
                          uid={user.uid}
                          displayName={user.displayName}
                          photoURL={user.photoURL}
                          showStatus={false}
                          size={40}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {user.displayName}
                          </Typography>
                        }
                      />
                      {creating === user.uid && <CircularProgress size={18} />}
                    </ListItemButton>
                  </ListItem>
                </motion.div>
              ))}
            </List>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
