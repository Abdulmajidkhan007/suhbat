// src/components/admin/AdminReportsPanel.tsx — shikoyat qilingan xabarlar: faqat shularning mazmuni ko'rinadi.
import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, TablePagination, Typography } from '@mui/material';
import type { AdminReportList } from '@suhbat/core';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';
import { CHAT_KIND_LABELS } from './activityLabels';

const PAGE_SIZE = 20;

const AdminReportsPanel: React.FC = () => {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.admin.reports({ page: page + 1, pageSize: PAGE_SIZE }).then(
      (d) => { if (!cancelled) setData(d); },
      (e: unknown) => { if (!cancelled) setError(errorText(e, 'Shikoyatlarni yuklab bo\'lmadi.')); },
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  const preview = async (attachmentId: string) => {
    try {
      setShown((s) => ({ ...s, [attachmentId]: '…' }));
      const p = await api.admin.mediaPreview(attachmentId);
      setShown((s) => ({ ...s, [attachmentId]: p.url }));
    } catch (e) {
      setShown((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== attachmentId)));
      setError(errorText(e, 'Biriktirmani ko\'rsatib bo\'lmadi.'));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Alert severity="warning" sx={{ borderRadius: '10px' }}>
        Faqat foydalanuvchi shikoyat qilgan xabarlarning mazmuni ko'rinadi. Boshqa xabarlar matni administratorga ko'rinmaydi.
      </Alert>
      {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
      {(data?.items ?? []).map((r) => (
        <Paper key={r.id} variant="outlined" sx={{ p: 1.5, borderRadius: '12px' }}>
          <Box className="flex flex-wrap items-center gap-1 mb-1">
            <Chip size="small" label={CHAT_KIND_LABELS[r.chatKind]} />
            <Typography variant="caption" color="text.secondary">
              {new Date(r.createdAt).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'short' })} · shikoyat qildi: {r.reporterLabel ?? '—'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">Muallif: {r.message.senderLabel ?? '—'}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', my: 0.5 }}>
            {r.message.deleted ? '(xabar o\'chirilgan)' : r.message.content || '(matnsiz)'}
          </Typography>
          {r.reason && <Typography variant="caption" color="text.secondary">Izoh: {r.reason}</Typography>}
          {r.message.attachmentId && !r.message.deleted && (
            shown[r.message.attachmentId] && shown[r.message.attachmentId] !== '…'
              ? <Button size="small" href={shown[r.message.attachmentId]} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>Biriktirmani ochish</Button>
              : <Button size="small" onClick={() => void preview(r.message.attachmentId!)} sx={{ textTransform: 'none' }}>Biriktirmani ko'rish</Button>
          )}
        </Paper>
      ))}
      {loading && <Box className="flex justify-center py-3"><CircularProgress size={22} aria-label="Yuklanmoqda" /></Box>}
      {!loading && !error && (data?.items.length ?? 0) === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 5 }}>Shikoyatlar yo'q</Typography>
      )}
      <TablePagination
        component="div" count={data?.total ?? 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
        onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
      />
    </div>
  );
};

export default AdminReportsPanel;
