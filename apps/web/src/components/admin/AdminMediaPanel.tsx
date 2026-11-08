// src/components/admin/AdminMediaPanel.tsx — yuklangan media (metadata) va jami hajm. Mazmun faqat ruxsat etilganda.
import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { ActivityChatKind, ActivityMediaKind, AdminMediaList, AdminMediaPreview } from '@suhbat/core';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';
import { formatFileSize } from '../../utils/formatters';
import { CHAT_KIND_LABELS, MEDIA_KIND_LABELS } from './activityLabels';
import PrivacyNote from './PrivacyNote';

const PAGE_SIZE = 20;
const MEDIA_KINDS = Object.keys(MEDIA_KIND_LABELS) as ActivityMediaKind[];
const CHAT_KINDS = Object.keys(CHAT_KIND_LABELS) as ActivityChatKind[];

const PreviewDialog: React.FC<{ preview: AdminMediaPreview | null; onClose: () => void }> = ({ preview, onClose }) => (
  <Dialog open={preview !== null} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ wordBreak: 'break-all' }}>{preview?.name}</DialogTitle>
    <DialogContent>
      {preview?.kind === 'image' && <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', borderRadius: 8 }} />}
      {preview?.kind === 'video' && <video src={preview.url} controls style={{ maxWidth: '100%' }} />}
      {preview?.kind === 'voice' && <audio src={preview.url} controls style={{ width: '100%' }} />}
      {preview?.kind === 'file' && <Button href={preview.url} target="_blank" rel="noreferrer">Faylni ochish</Button>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Yopish</Button></DialogActions>
  </Dialog>
);

const AdminMediaPanel: React.FC = () => {
  const [kind, setKind] = useState<ActivityMediaKind | ''>('');
  const [chatKind, setChatKind] = useState<ActivityChatKind | ''>('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminMediaList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminMediaPreview | null>(null);

  useEffect(() => { setPage(0); }, [kind, chatKind]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.admin.media({ kind: kind || undefined, chatKind: chatKind || undefined, page: page + 1, pageSize: PAGE_SIZE }).then(
      (d) => { if (!cancelled) setData(d); },
      (e: unknown) => { if (!cancelled) setError(errorText(e, 'Media ro\'yxatini yuklab bo\'lmadi.')); },
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, chatKind, page]);

  const open = async (attachmentId: string) => {
    try {
      setPreview(await api.admin.mediaPreview(attachmentId));
    } catch (e) {
      setError(errorText(e, 'Mazmunni ko\'rsatib bo\'lmadi.'));
    }
  };

  const stats = data?.stats;
  return (
    <div className="flex flex-col gap-3">
      <PrivacyNote />
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '12px' }} data-testid="media-stats">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Jami: {stats ? `${stats.totalCount} ta fayl · ${formatFileSize(stats.totalBytes)}` : '…'}
        </Typography>
        <Box className="flex flex-wrap gap-1 mt-1">
          {(stats?.byKind ?? []).map((k) => (
            <Chip key={k.kind} size="small" variant="outlined" label={`${MEDIA_KIND_LABELS[k.kind]}: ${k.count} · ${formatFileSize(k.bytes)}`} />
          ))}
        </Box>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <TextField select size="small" label="Turi" value={kind} onChange={(e) => setKind(e.target.value as ActivityMediaKind | '')}>
          <MenuItem value="">Hammasi</MenuItem>
          {MEDIA_KINDS.map((k) => <MenuItem key={k} value={k}>{MEDIA_KIND_LABELS[k]}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Chat turi" value={chatKind} onChange={(e) => setChatKind(e.target.value as ActivityChatKind | '')}>
          <MenuItem value="">Hammasi</MenuItem>
          {CHAT_KINDS.map((k) => <MenuItem key={k} value={k}>{CHAT_KIND_LABELS[k]}</MenuItem>)}
        </TextField>
      </Box>
      {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Media">
          <TableHead>
            <TableRow>
              <TableCell>Qachon</TableCell>
              <TableCell>Kim</TableCell>
              <TableCell>Fayl</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Chat</TableCell>
              <TableCell align="right">Mazmun</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.items ?? []).map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.userLabel ?? '—'}</TableCell>
                <TableCell sx={{ maxWidth: 240 }}>
                  <Typography variant="body2" noWrap title={e.media?.name}>{e.media?.name}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {e.media ? `${MEDIA_KIND_LABELS[e.media.kind]} · ${e.media.mime} · ${formatFileSize(e.media.size)}` : ''}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  {e.chatKind ? `${CHAT_KIND_LABELS[e.chatKind]}${e.chatKind === 'channel' ? (e.chatPublic ? ' · ochiq' : ' · yopiq') : ''}` : '—'}
                </TableCell>
                <TableCell align="right">
                  {e.media?.previewable && e.media.attachmentId
                    ? <Button size="small" onClick={() => void open(e.media!.attachmentId!)} sx={{ textTransform: 'none' }}>Ko'rish</Button>
                    : <Chip size="small" icon={<LockOutlinedIcon />} label="maxfiy" variant="outlined" />}
                </TableCell>
              </TableRow>
            ))}
            {!loading && !error && (data?.items.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>Yuklangan media yo'q</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box className="flex justify-center py-3"><CircularProgress size={22} aria-label="Yuklanmoqda" /></Box>}
        <TablePagination
          component="div" count={data?.total ?? 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </TableContainer>
      <PreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default AdminMediaPanel;
