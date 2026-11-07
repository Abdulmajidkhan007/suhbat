// src/components/layout/AdminLink.tsx — Sozlamalarda "Admin panel" havolasi: faqat `isAdmin` bo'lsa.
import React from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAppSelector } from '../../app/hooks';

const sx = { textTransform: 'none', borderRadius: '10px' } as const;
const icon = <AdminPanelSettingsIcon fontSize="small" />;

const RouterButton: React.FC = () => {
  const navigate = useNavigate();
  return <Button variant="outlined" fullWidth startIcon={icon} onClick={() => navigate('/admin')} sx={sx}>Admin panel</Button>;
};

const AdminLink: React.FC = () => {
  const isAdmin = useAppSelector((s) => s.auth.user?.isAdmin === true);
  const inRouter = useInRouterContext();
  if (!isAdmin) return null;
  // Router tashqarisida (izolyatsiyalangan render) oddiy havola.
  return inRouter
    ? <RouterButton />
    : <Button component="a" href="/admin" variant="outlined" fullWidth startIcon={icon} sx={sx}>Admin panel</Button>;
};

export default AdminLink;
