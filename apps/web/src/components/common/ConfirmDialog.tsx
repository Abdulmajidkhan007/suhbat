import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface Props {
  open:          boolean;
  title:         string;
  description?:  string;
  confirmLabel?: string;
  /** Qaytarib bo'lmaydigan amal — tugma qizil. */
  destructive?:  boolean;
  loading?:      boolean;
  onConfirm:     () => void;
  onClose:       () => void;
}

const ConfirmDialog: React.FC<Props> = ({
  open, title, description, confirmLabel = 'Tasdiqlash', destructive = false, loading = false, onConfirm, onClose,
}) => (
  <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    {description && (
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
    )}
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>Bekor qilish</Button>
      <Button
        onClick={onConfirm}
        disabled={loading}
        variant="contained"
        color={destructive ? 'error' : 'primary'}
        sx={{ textTransform: 'none' }}
      >
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
