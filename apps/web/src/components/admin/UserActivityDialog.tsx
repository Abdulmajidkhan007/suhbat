// src/components/admin/UserActivityDialog.tsx — bitta foydalanuvchining faoliyat tarixi.
import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import type { AdminUser } from '@suhbat/core';
import AdminActivityPanel from './AdminActivityPanel';
import { who } from './adminActions';
import PrivacyNote from './PrivacyNote';

const UserActivityDialog: React.FC<{ user: AdminUser | null; onClose: () => void }> = ({ user, onClose }) => (
  <Dialog open={user !== null} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle sx={{ fontWeight: 700 }}>Faoliyat tarixi: {user ? who(user) : ''}</DialogTitle>
    <DialogContent>
      <div className="flex flex-col gap-3 pt-1">
        <PrivacyNote />
        {user && <AdminActivityPanel fixedUserId={user.id} showNote={false} />}
      </div>
    </DialogContent>
    <DialogActions><Button onClick={onClose} sx={{ textTransform: 'none' }}>Yopish</Button></DialogActions>
  </Dialog>
);

export default UserActivityDialog;
