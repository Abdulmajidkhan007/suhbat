import React, { useEffect, useState } from 'react';
import {
  Avatar, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import toast from 'react-hot-toast';
import type { PublicChannel } from '@suhbat/core';
import SearchInput from '../common/SearchInput';
import { api } from '../../services/api';
import { toChat } from '../../services/apiMappers';
import { upsertChat } from '../../features/chats/chatsSlice';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useDebounce } from '../../hooks/useDebounce';
import { errorText } from '../../utils/errors';

interface Props {
  open:     boolean;
  onClose:  () => void;
  /** Obuna bo'lingach yoki a'zo kanal tanlanganda. */
  onOpenChat: (chatId: string) => void;
}

const ChannelSearchDialog: React.FC<Props> = ({ open, onClose, onOpenChat }) => {
  const dispatch = useAppDispatch();
  const me       = useAppSelector((s) => s.auth.user)!;
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<PublicChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const debounced = useDebounce(query, 350);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api.searchPublicChannels(debounced.trim() || undefined).then(
      (list) => { if (!cancelled) { setResults(list); setLoading(false); } },
      () => { if (!cancelled) { setResults([]); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [debounced, open]);

  const close = () => { setQuery(''); onClose(); };

  const join = async (channel: PublicChannel) => {
    setBusyId(channel.id);
    try {
      if (!channel.isMember) {
        const chat = await api.joinChannel(channel.id);
        dispatch(upsertChat(toChat(chat, me.uid)));
      }
      close();
      onOpenChat(channel.id);
    } catch (e) {
      toast.error(errorText(e, 'Kanalga obuna bo\'lib bo\'lmadi.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: '16px', maxHeight: '80vh' } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Ochiq kanallar</DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Kanal nomi…" />
      </Box>
      <DialogContent sx={{ px: 1 }}>
        {loading && <Box className="flex justify-center py-4"><CircularProgress size={22} /></Box>}
        {!loading && results.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {query.trim() ? 'Bunday kanal topilmadi.' : 'Hali ochiq kanallar yo\'q.'}
          </Typography>
        )}
        <List disablePadding>
          {results.map((c) => (
            <ListItem
              key={c.id}
              secondaryAction={
                <Button size="small" variant={c.isMember ? 'text' : 'contained'} disabled={busyId === c.id} onClick={() => void join(c)} sx={{ textTransform: 'none' }}>
                  {c.isMember ? 'Ochish' : 'Obuna bo\'lish'}
                </Button>
              }
              sx={{ pr: 16, gap: 1.5 }}
            >
              <Avatar sx={{ bgcolor: 'secondary.main' }}><CampaignIcon /></Avatar>
              <ListItemText
                primary={c.title}
                secondary={`${c.memberCount} obunachi${c.description ? ` · ${c.description}` : ''}`}
                slotProps={{ primary: { noWrap: true, variant: 'body2', sx: { fontWeight: 600 } }, secondary: { noWrap: true } }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelSearchDialog;
