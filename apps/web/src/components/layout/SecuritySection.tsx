// src/components/layout/SecuritySection.tsx — Sozlamalar: tiklash kodlari va parolni o'zgartirish.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import LockResetIcon from '@mui/icons-material/LockReset';
import toast from 'react-hot-toast';
import { ApiError } from '@suhbat/client';
import { PASSWORD_MAX, RECOVERY_CODE_COUNT } from '@suhbat/core';
import type { RecoveryCodesStatus } from '@suhbat/core';
import { api } from '../../services/api';
import { errorText } from '../../utils/errors';
import LoadingButton from '../common/LoadingButton';
import NewPasswordFields, { newPasswordError } from '../auth/NewPasswordFields';
import RecoveryCodesView from '../auth/RecoveryCodesView';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };
const wrongPassword = (e: unknown) => e instanceof ApiError && e.status === 400;

const CurrentPasswordField: React.FC<{ value: string; onChange: (v: string) => void; disabled: boolean }> = ({ value, onChange, disabled }) => (
  <TextField
    label="Joriy parol"
    type="password"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    fullWidth
    size="small"
    autoFocus
    autoComplete="current-password"
    disabled={disabled}
    sx={fieldSx}
    slotProps={{ htmlInput: { maxLength: PASSWORD_MAX } }}
  />
);

/** Joriy parol bilan yangi kodlar yaratish; natija bir marta ko'rsatiladi. */
const RegenerateDialog: React.FC<{ open: boolean; onClose: () => void; onDone: () => void }> = ({ open, onClose, onDone }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const reset = () => {
    setPassword('');
    setError(null);
    setCodes(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setError('Joriy parolni kiriting.');
    setLoading(true);
    setError(null);
    try {
      setCodes(await api.regenerateRecoveryCodes(password));
      setPassword('');
      onDone();
    } catch (err) {
      setError(wrongPassword(err) ? 'Joriy parol noto\'g\'ri.' : errorText(err, 'Kodlarni yaratib bo\'lmadi.'));
    } finally {
      setLoading(false);
    }
  };

  // Kodlar ko'rsatilayotganda tasodifan yopilmasin — faqat "saqladim" tugmasi bilan.
  const close = () => {
    if (codes) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>{codes ? 'Yangi tiklash kodlari' : 'Tiklash kodlarini yaratish'}</DialogTitle>
      <DialogContent>
        {codes ? (
          <RecoveryCodesView codes={codes} doneLabel="Tayyor" onDone={() => { reset(); onClose(); }} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3 pt-1">
            <Typography variant="body2" color="text.secondary">
              Eski kodlar bekor bo'ladi. Tasdiqlash uchun joriy parolingizni kiriting.
            </Typography>
            {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
            <CurrentPasswordField value={password} onChange={setPassword} disabled={loading} />
            <div className="flex gap-2 justify-end">
              <Button onClick={close} sx={{ textTransform: 'none' }}>Bekor qilish</Button>
              <LoadingButton type="submit" variant="contained" loading={loading}>Yaratish</LoadingButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ChangePasswordDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCurrent('');
    setPassword('');
    setConfirm('');
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return setError('Joriy parolni kiriting.');
    const pwError = newPasswordError(password, confirm);
    if (pwError) return setError(pwError);
    setLoading(true);
    setError(null);
    try {
      await api.changePassword(current, password);
      toast.success('Parol o\'zgardi. Boshqa qurilmalardan chiqildi.');
      close();
    } catch (err) {
      setError(wrongPassword(err) ? 'Joriy parol noto\'g\'ri.' : errorText(err, 'Parolni o\'zgartirib bo\'lmadi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Parolni o'zgartirish</DialogTitle>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 pt-1">
          {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
          <CurrentPasswordField value={current} onChange={setCurrent} disabled={loading} />
          <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} disabled={loading} size="small" />
          <Typography variant="caption" color="text.secondary">Boshqa qurilmalardagi sessiyalar yopiladi.</Typography>
          <div className="flex gap-2 justify-end">
            <Button onClick={close} sx={{ textTransform: 'none' }}>Bekor qilish</Button>
            <LoadingButton type="submit" variant="contained" loading={loading}>Saqlash</LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const statusText = (s: RecoveryCodesStatus) => {
  if (!s.generatedAt) return 'Hali yaratilmagan';
  return `${s.remaining} / ${RECOVERY_CODE_COUNT} ta qoldi`;
};

const SecuritySection: React.FC = () => {
  const [status, setStatus] = useState<RecoveryCodesStatus | null>(null);
  const [dialog, setDialog] = useState<'codes' | 'password' | null>(null);

  const load = useCallback(() => {
    api.getRecoveryCodesStatus().then(setStatus, () => undefined);
  }, []);
  useEffect(load, [load]);

  const needsCodes = status !== null && (!status.generatedAt || status.remaining <= 2);

  return (
    <div>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
        Xavfsizlik
      </Typography>
      <Box className="flex flex-col gap-2 mt-3">
        {needsCodes && (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            {status?.generatedAt
              ? 'Tiklash kodlari kam qoldi — yangisini yarating.'
              : 'Parolni unutsangiz, email\'siz tiklash uchun tiklash kodlarini yarating.'}
          </Alert>
        )}
        <Box className="flex items-center justify-between gap-2">
          <div>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Tiklash kodlari</Typography>
            <Typography variant="caption" color="text.secondary">{status ? statusText(status) : '…'}</Typography>
          </div>
          <Button
            size="small"
            variant="outlined"
            startIcon={<KeyIcon fontSize="small" />}
            onClick={() => setDialog('codes')}
            sx={{ textTransform: 'none', borderRadius: '10px', flexShrink: 0 }}
          >
            {status?.generatedAt ? 'Yangilash' : 'Yaratish'}
          </Button>
        </Box>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<LockResetIcon fontSize="small" />}
          onClick={() => setDialog('password')}
          sx={{ textTransform: 'none', borderRadius: '10px' }}
        >
          Parolni o'zgartirish
        </Button>
      </Box>
      <RegenerateDialog open={dialog === 'codes'} onClose={() => setDialog(null)} onDone={load} />
      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
    </div>
  );
};

export default SecuritySection;
