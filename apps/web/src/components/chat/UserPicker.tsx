import React, { useEffect, useState } from 'react';
import { Box, Chip, CircularProgress, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import SearchInput from '../common/SearchInput';
import AvatarWithStatus from '../common/AvatarWithStatus';
import { api } from '../../services/api';
import { toAppUser } from '../../services/apiMappers';
import { useDebounce } from '../../hooks/useDebounce';
import { AppUser } from '../../types';

interface Props {
  selected:    AppUser[];
  onChange:    (users: AppUser[]) => void;
  /** Allaqachon a'zo bo'lganlar ro'yxatda ko'rsatilmaydi. */
  excludeIds?: string[];
  maxHeight?:  number;
}

/** Ism (qism) yoki to'liq email bo'yicha qidirib, bir nechta odam tanlash. */
const UserPicker: React.FC<Props> = ({ selected, onChange, excludeIds = [], maxHeight = 220 }) => {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 350);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.searchUsers(q).then(
      (users) => { if (!cancelled) { setResults(users.map(toAppUser)); setLoading(false); } },
      () => { if (!cancelled) { setResults([]); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [debounced]);

  const chosen = new Set(selected.map((u) => u.uid));
  const visible = results.filter((u) => !excludeIds.includes(u.uid));

  const toggle = (user: AppUser) =>
    onChange(chosen.has(user.uid) ? selected.filter((u) => u.uid !== user.uid) : [...selected, user]);

  return (
    <Box>
      {selected.length > 0 && (
        <Box className="flex flex-wrap gap-1 mb-2">
          {selected.map((u) => (
            <Chip
              key={u.uid}
              label={u.displayName}
              size="small"
              onDelete={() => toggle(u)}
              aria-label={`${u.displayName} ni olib tashlash`}
            />
          ))}
        </Box>
      )}
      <SearchInput value={query} onChange={setQuery} placeholder="Ism yoki to'liq email…" />
      <Box sx={{ maxHeight, overflowY: 'auto', mt: 1 }}>
        {loading && (
          <Box className="flex justify-center py-3"><CircularProgress size={20} /></Box>
        )}
        {!loading && query.trim() && visible.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1.5, textAlign: 'center' }}>
            Hech kim topilmadi
          </Typography>
        )}
        <List disablePadding>
          {visible.map((u) => (
            <ListItemButton key={u.uid} selected={chosen.has(u.uid)} onClick={() => toggle(u)} sx={{ borderRadius: '10px', gap: 1.5 }}>
              <AvatarWithStatus uid={u.uid} displayName={u.displayName} photoURL={u.photoURL} showStatus={false} size={32} />
              <ListItemText primary={u.displayName} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default UserPicker;
