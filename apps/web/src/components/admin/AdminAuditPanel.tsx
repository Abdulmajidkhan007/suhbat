// src/components/admin/AdminAuditPanel.tsx — admin amallari jurnali (kim, qachon, nima, kimga).
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow } from '@mui/material';
import type { AdminAuditAction, AdminAuditList } from '@suhbat/core';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';

const PAGE_SIZE = 20;

export const AUDIT_LABELS: Record<AdminAuditAction, string> = {
  'user.block':          'Bloklandi',
  'user.unblock':        'Blokdan chiqarildi',
  'user.revoke_sessions': 'Sessiyalar yopildi',
  'user.temp_password':  'Vaqtinchalik parol berildi',
  'user.recovery_codes': 'Yangi tiklash kodlari',
  'user.delete':         'O\'chirildi',
};

const AdminAuditPanel: React.FC = () => {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminAuditList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.admin.audit({ page: page + 1, pageSize: PAGE_SIZE }).then(
      (d) => { if (!cancelled) setData(d); },
      (e: unknown) => { if (!cancelled) setError(errorText(e, 'Jurnalni yuklab bo\'lmadi.')); },
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Admin jurnali">
          <TableHead>
            <TableRow>
              <TableCell>Qachon</TableCell>
              <TableCell>Kim</TableCell>
              <TableCell>Amal</TableCell>
              <TableCell>Kimga</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.items ?? []).map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'medium' })}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.adminEmail}</TableCell>
                <TableCell>{AUDIT_LABELS[e.action] ?? e.action}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.targetLabel}</TableCell>
              </TableRow>
            ))}
            {!loading && !error && (data?.items.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>Hozircha yozuv yo'q</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box className="flex justify-center py-3"><CircularProgress size={22} aria-label="Yuklanmoqda" /></Box>}
        <TablePagination
          component="div" count={data?.total ?? 0} page={page} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </TableContainer>
    </div>
  );
};

export default AdminAuditPanel;
