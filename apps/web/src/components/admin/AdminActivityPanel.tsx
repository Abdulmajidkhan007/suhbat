// src/components/admin/AdminActivityPanel.tsx — faoliyat jurnali: filtr, sahifalash. Faqat metadata.
import React, { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, CircularProgress, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography,
} from '@mui/material';
import { ActivityTypeSchema } from '@suhbat/core';
import type { ActivityChatKind, ActivityType, AdminActivityList, AdminUser } from '@suhbat/core';
import { useDebounce } from '../../hooks/useDebounce';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';
import { activityLabel, CHAT_KIND_LABELS, describeMeta } from './activityLabels';
import PrivacyNote from './PrivacyNote';

const PAGE_SIZE = 20;
const KINDS = Object.keys(CHAT_KIND_LABELS) as ActivityChatKind[];
const TYPES = ActivityTypeSchema.options as ActivityType[];

/** `YYYY-MM-DD` (mahalliy kun boshi) → ISO; bo'sh → undefined. */
export const dayStart = (v: string, addDays = 0): string | undefined => {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
};

const when = (iso: string) => new Date(iso).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'medium' });

interface Props {
  /** Berilsa — shu foydalanuvchi tarixi (foydalanuvchi filtri yashirin). */
  fixedUserId?: string;
  /** Eslatma ko'rsatilsinmi (dialogda ortiqcha). */
  showNote?: boolean;
}

const AdminActivityPanel: React.FC<Props> = ({ fixedUserId, showNote = true }) => {
  const [type, setType] = useState<ActivityType | ''>('');
  const [chatKind, setChatKind] = useState<ActivityChatKind | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [options, setOptions] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminActivityList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debouncedUser = useDebounce(userQuery.trim(), 300);
  const userId = fixedUserId ?? picked?.id;

  useEffect(() => {
    if (fixedUserId) return;
    let cancelled = false;
    api.admin.listUsers({ q: debouncedUser, pageSize: 10 }).then((r) => { if (!cancelled) setOptions(r.items); }, () => undefined);
    return () => { cancelled = true; };
  }, [debouncedUser, fixedUserId]);

  useEffect(() => { setPage(0); }, [type, chatKind, from, to, userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.admin.activity({
      userId, type: type || undefined, chatKind: chatKind || undefined,
      from: dayStart(from), to: dayStart(to, 1), page: page + 1, pageSize: PAGE_SIZE,
    }).then(
      (d) => { if (!cancelled) setData(d); },
      (e: unknown) => { if (!cancelled) setError(errorText(e, 'Jurnalni yuklab bo\'lmadi.')); },
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, type, chatKind, from, to, page]);

  return (
    <div className="flex flex-col gap-3">
      {showNote && <PrivacyNote />}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: fixedUserId ? 'repeat(4, 1fr)' : '1.6fr repeat(4, 1fr)' }, gap: 1.5 }}>
        {!fixedUserId && (
          <Autocomplete
            size="small" options={options} value={picked} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
            getOptionLabel={(u) => `${u.displayName} (${u.username ? `@${u.username}` : u.email})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(o) => o}
            onChange={(_, v) => setPicked(v)}
            onInputChange={(_, v, reason) => { if (reason === 'input') setUserQuery(v); }}
            renderInput={(params) => <TextField {...params} label="Foydalanuvchi" />}
            noOptionsText="Topilmadi"
          />
        )}
        <TextField select size="small" label="Turi" value={type} onChange={(e) => setType(e.target.value as ActivityType | '')}>
          <MenuItem value="">Hammasi</MenuItem>
          {TYPES.map((t) => <MenuItem key={t} value={t}>{activityLabel(t)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Chat turi" value={chatKind} onChange={(e) => setChatKind(e.target.value as ActivityChatKind | '')}>
          <MenuItem value="">Hammasi</MenuItem>
          {KINDS.map((k) => <MenuItem key={k} value={k}>{CHAT_KIND_LABELS[k]}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="Dan" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="Gacha" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Faoliyat">
          <TableHead>
            <TableRow>
              <TableCell>Qachon</TableCell>
              {!fixedUserId && <TableCell>Kim</TableCell>}
              <TableCell>Amal</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Chat</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>IP · qurilma</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.items ?? []).map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{when(e.createdAt)}</TableCell>
                {!fixedUserId && <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.userLabel ?? '—'}</TableCell>}
                <TableCell>
                  {activityLabel(e.type)}
                  {e.media && <Typography variant="caption" color="text.secondary" component="div" noWrap>{e.media.name}</Typography>}
                  <Typography variant="caption" color="text.secondary" component="div">{describeMeta(e.meta)}</Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  {e.chatKind ? `${CHAT_KIND_LABELS[e.chatKind]}${e.chatKind === 'channel' ? (e.chatPublic ? ' · ochiq' : ' · yopiq') : ''}` : '—'}
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 260 }}>
                  <Typography variant="body2" noWrap>{e.ip ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap title={e.device ?? ''}>{e.device ?? ''}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !error && (data?.items.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>Yozuv yo'q</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box className="flex justify-center py-3"><CircularProgress size={22} aria-label="Yuklanmoqda" /></Box>}
        <TablePagination
          component="div" count={data?.total ?? 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from: a, to: b, count }) => `${a}–${b} / ${count}`}
        />
      </TableContainer>
    </div>
  );
};

export default AdminActivityPanel;
