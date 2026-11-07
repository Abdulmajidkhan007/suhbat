// src/pages/PrivacyPage.tsx — «Maxfiylik»: qaysi ma'lumotlar yoziladi, qancha saqlanadi, xabar matni o'qilmasligi.
import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { DEFAULT_PRIVACY_RETENTION_DAYS, privacySections } from '@suhbat/core';
import { api } from '../services/api';

const PrivacyPage: React.FC = () => {
  // Server aytgan muddat; javob kelmaguncha (yoki xato) standart qiymat va izoh.
  const [days, setDays] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.getPrivacyInfo().then((i) => { if (!cancelled) setDays(i.retentionDays); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const sections = privacySections(days ?? DEFAULT_PRIVACY_RETENTION_DAYS);
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box className="mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-4">
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>Maxfiylik</Typography>
        <Typography color="text.secondary">
          Suhbat administratori xizmat ishlashi va suiiste'molni oldini olish uchun quyidagi ma'lumotlarni ko'ra oladi. Bu yerda yozilganlar
          kodda ham shunday ta'minlangan.
        </Typography>
        {failed && (
          <Typography variant="caption" color="warning.main">
            Saqlash muddatini serverdan olib bo'lmadi — ko'rsatilgan {DEFAULT_PRIVACY_RETENTION_DAYS} kun standart qiymat; aniq muddat server sozlamasida.
          </Typography>
        )}
        {sections.map((s) => (
          <Paper key={s.title} variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1 }}>{s.title}</Typography>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {s.items.map((it) => <li key={it}><Typography variant="body2" sx={{ mb: 0.5 }}>{it}</Typography></li>)}
            </ul>
          </Paper>
        ))}
        <RouterLink to="/" style={{ color: 'inherit' }}>← Chatlarga qaytish</RouterLink>
      </Box>
    </Box>
  );
};

export default PrivacyPage;
