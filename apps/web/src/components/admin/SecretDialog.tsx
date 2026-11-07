// src/components/admin/SecretDialog.tsx — vaqtinchalik parol / tiklash kodlari: bir marta ko'rsatiladi, nusxa tugmasi bilan.
import React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import toast from 'react-hot-toast';

interface Props {
  open:        boolean;
  title:       string;
  description: string;
  /** Nusxa tugmasi hammasini (qatorma-qator) nusxalaydi. */
  values:      string[];
  onClose:     () => void;
}

const SecretDialog: React.FC<Props> = ({ open, title, description, values, onClose }) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(values.join('\n'));
      toast.success('Nusxalandi');
    } catch {
      toast.error('Nusxalab bo\'lmadi — qo\'lda yozib oling.');
    }
  };

  // Tasodifan yopilmasin (qayta ko'rsatib bo'lmaydi) — faqat "Yopish" tugmasi bilan.
  return (
    <Dialog open={open} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-3">
          <Alert severity="warning" sx={{ borderRadius: '10px' }}>{description}</Alert>
          <Box
            data-testid="secret-values"
            sx={{
              bgcolor: 'action.hover', borderRadius: '10px', p: 1.5, display: 'grid',
              gridTemplateColumns: values.length > 1 ? { xs: '1fr', sm: '1fr 1fr' } : '1fr', gap: 0.5,
            }}
          >
            {values.map((v) => (
              <Typography key={v} component="code" sx={{ fontFamily: 'monospace', fontSize: '1rem', wordBreak: 'break-all', userSelect: 'all' }}>
                {v}
              </Typography>
            ))}
          </Box>
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => void copy()} sx={{ textTransform: 'none' }}>
          Nusxa olish
        </Button>
        <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none' }}>Yopish</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SecretDialog;
