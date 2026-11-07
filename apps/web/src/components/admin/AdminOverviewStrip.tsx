// src/components/admin/AdminOverviewStrip.tsx — bosh sahifa statistikasi: bugun faol, yangi, media hajmi.
import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { AdminOverview } from '@suhbat/core';
import { api } from '../../services/api';
import { formatFileSize } from '../../utils/formatters';

const AdminOverviewStrip: React.FC = () => {
  const [data, setData] = useState<AdminOverview | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.admin.overview().then((d) => { if (!cancelled) setData(d); }, () => undefined);
    return () => { cancelled = true; };
  }, []);

  const cards: [string, string][] = [
    ['Foydalanuvchilar', data ? String(data.usersTotal) : '…'],
    ['Bugun faol', data ? String(data.activeToday) : '…'],
    ['Bugun yangi', data ? String(data.newUsersToday) : '…'],
    ['Media (24 soat)', data ? formatFileSize(data.mediaBytes24h) : '…'],
    ['Media (jami)', data ? formatFileSize(data.mediaBytesTotal) : '…'],
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1.5 }} data-testid="overview">
      {cards.map(([label, value]) => (
        <Paper key={label} variant="outlined" sx={{ p: 1.5, borderRadius: '12px' }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
        </Paper>
      ))}
    </Box>
  );
};

export default AdminOverviewStrip;
