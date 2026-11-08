// src/components/layout/PrivacyLink.tsx — Sozlamalarda «Maxfiylik» havolasi.
import React from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';

const sx = { textTransform: 'none', borderRadius: '10px' } as const;
const icon = <PrivacyTipOutlinedIcon fontSize="small" />;

const RouterButton: React.FC = () => {
  const navigate = useNavigate();
  return <Button variant="outlined" fullWidth startIcon={icon} onClick={() => navigate('/privacy')} sx={sx}>Maxfiylik</Button>;
};

const PrivacyLink: React.FC = () =>
  useInRouterContext()
    ? <RouterButton />
    : <Button component="a" href="/privacy" variant="outlined" fullWidth startIcon={icon} sx={sx}>Maxfiylik</Button>;

export default PrivacyLink;
