// src/components/auth/RecoveryCodesView.tsx — parolni tiklash kodlarini bir marta ko'rsatish.
import React, { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import toast from 'react-hot-toast';

interface Props {
  codes: string[];
  /** Foydalanuvchi "saqladim" deb tasdiqlagach. */
  onDone: () => void;
  doneLabel?: string;
}

const fileText = (codes: string[]) => [
  'Suhbat — parolni tiklash kodlari',
  `Yaratilgan: ${new Date().toLocaleString('uz-UZ')}`,
  '',
  'Har bir kod faqat BIR MARTA ishlaydi. Parolni unutsangiz:',
  'Kirish → "Parolni unutdim?" → "Tiklash kodi bilan".',
  'Kodlarni hech kimga bermang.',
  '',
  ...codes,
  '',
].join('\n');

/**
 * Kodlar faqat shu ekranda ko'rinadi (serverda faqat hash). Nusxa olish, `.txt` yuklab olish
 * va "saqladim" tasdig'isiz davom etib bo'lmaydi.
 */
const RecoveryCodesView: React.FC<Props> = ({ codes, onDone, doneLabel = 'Davom etish' }) => {
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Kodlar nusxalandi');
    } catch {
      toast.error('Nusxalab bo\'lmadi — kodlarni qo\'lda yozib oling.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([fileText(codes)], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suhbat-tiklash-kodlari.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert severity="warning" sx={{ borderRadius: '10px' }}>
        Parolni unutsangiz, shu kodlardan biri bilan tiklaysiz (email kerak emas). Har bir kod <b>bir marta</b> ishlaydi.
        Ular <b>boshqa ko'rsatilmaydi</b> — hozir saqlab qo'ying.
      </Alert>
      <Box
        component="ul"
        aria-label="Tiklash kodlari"
        sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' }, gap: 1, p: 2, m: 0, listStyle: 'none',
          borderRadius: '10px', bgcolor: 'action.hover', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {codes.map((c) => (
          <Typography key={c} component="li" sx={{ fontFamily: 'inherit', fontSize: { xs: '0.85rem', sm: '0.95rem' }, textAlign: 'center' }}>
            {c}
          </Typography>
        ))}
      </Box>
      <div className="flex gap-2">
        <Button variant="outlined" fullWidth startIcon={<ContentCopyIcon />} onClick={() => void copy()} sx={{ textTransform: 'none', borderRadius: '10px' }}>
          Nusxa olish
        </Button>
        <Button variant="outlined" fullWidth startIcon={<DownloadIcon />} onClick={download} sx={{ textTransform: 'none', borderRadius: '10px' }}>
          .txt yuklab olish
        </Button>
      </div>
      <FormControlLabel
        control={<Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} />}
        label="Kodlarni xavfsiz joyga saqladim"
      />
      <Button variant="contained" size="large" disabled={!saved} onClick={onDone} sx={{ textTransform: 'none', borderRadius: '10px' }}>
        {doneLabel}
      </Button>
    </div>
  );
};

export default RecoveryCodesView;
