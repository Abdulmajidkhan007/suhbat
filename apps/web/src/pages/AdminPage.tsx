// src/pages/AdminPage.tsx — `/admin`: faqat adminlar (`isAdmin`); boshqalarga "topilmadi".
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAppSelector } from '../app/hooks';
import AdminActivityPanel from '../components/admin/AdminActivityPanel';
import AdminAuditPanel from '../components/admin/AdminAuditPanel';
import AdminMediaPanel from '../components/admin/AdminMediaPanel';
import AdminOverviewStrip from '../components/admin/AdminOverviewStrip';
import AdminReportsPanel from '../components/admin/AdminReportsPanel';
import AdminUsersPanel from '../components/admin/AdminUsersPanel';
import NotFoundPage from './NotFoundPage';

type Tab = 'users' | 'activity' | 'media' | 'reports' | 'audit';

const AdminPage: React.FC = () => {
  const isAdmin = useAppSelector((s) => s.auth.user?.isAdmin === true);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');

  // Panel borligi oddiy foydalanuvchiga bilinmasin (server ham 404 qaytaradi).
  if (!isAdmin) return <NotFoundPage />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box className="mx-auto w-full max-w-6xl px-4 py-4 flex flex-col gap-3">
        <Box className="flex items-center gap-1">
          <Tooltip title="Chatlarga qaytish">
            <IconButton onClick={() => navigate('/')} aria-label="Chatlarga qaytish"><ArrowBackIcon /></IconButton>
          </Tooltip>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>Admin panel</Typography>
        </Box>
        <AdminOverviewStrip />
        <Tabs value={tab} onChange={(_, v: Tab) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="users" label="Foydalanuvchilar" sx={{ textTransform: 'none' }} />
          <Tab value="activity" label="Faoliyat" sx={{ textTransform: 'none' }} />
          <Tab value="media" label="Media" sx={{ textTransform: 'none' }} />
          <Tab value="reports" label="Shikoyatlar" sx={{ textTransform: 'none' }} />
          <Tab value="audit" label="Admin jurnali" sx={{ textTransform: 'none' }} />
        </Tabs>
        {tab === 'users' && <AdminUsersPanel />}
        {tab === 'activity' && <AdminActivityPanel />}
        {tab === 'media' && <AdminMediaPanel />}
        {tab === 'reports' && <AdminReportsPanel />}
        {tab === 'audit' && <AdminAuditPanel />}
      </Box>
    </Box>
  );
};

export default AdminPage;
