import React, { useState, useRef, useEffect } from 'react';
import {
  TextField, Typography, Alert, InputAdornment, Box, Button,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationResult } from 'firebase/auth';
import LoadingButton from '../common/LoadingButton';
import { setupRecaptcha, sendPhoneOtp, verifyPhoneOtp } from '../../services/authService';
import { AppUser } from '../../types';

interface Props {
  onSuccess: (user: AppUser) => void;
  onBack:    () => void;
}

const PhoneAuthForm: React.FC<Props> = ({ onSuccess, onBack }) => {
  const [step, setStep]               = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone]             = useState('+998');
  const [otp, setOtp]                 = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [countdown, setCountdown]     = useState(0);
  const confirmRef                    = useRef<ConfirmationResult | null>(null);
  const timerRef                      = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    setupRecaptcha('recaptcha-container');
    return () => clearInterval(timerRef.current);
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phone.trim() || phone.length < 10) {
      setError('To\'g\'ri telefon raqam kiriting.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      confirmRef.current = await sendPhoneOtp(phone);
      setStep('otp');
      startCountdown();
    } catch (err) {
      setError((err as Error).message);
      setupRecaptcha('recaptcha-container');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('6 raqamli kod kiriting.'); return; }
    if (!confirmRef.current) { setError('Qayta telefon raqam kiriting.'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await verifyPhoneOtp(confirmRef.current, otp);
      onSuccess(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp('');
    setError('');
    setupRecaptcha('recaptcha-container');
    try {
      confirmRef.current = await sendPhoneOtp(phone);
      startCountdown();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col gap-4"
    >
      <div id="recaptcha-container" />

      {error && (
        <Alert severity="error" sx={{ borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <AnimatePresence mode="wait">
        {step === 'phone' ? (
          <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            <Typography variant="body2" color="text.secondary" align="center">
              Telefon raqamingizni kiriting. SMS kod yuboramiz.
            </Typography>
            <TextField
              label="Telefon raqam"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
              placeholder="+998 90 123 45 67"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <LoadingButton variant="contained" fullWidth loading={loading} onClick={handleSendOtp}>
              SMS kod yuborish
            </LoadingButton>
          </motion.div>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            <Typography variant="body2" color="text.secondary" align="center">
              <strong>{phone}</strong> raqamiga yuborilgan 6 raqamli kodni kiriting.
            </Typography>
            <TextField
              label="Tasdiqlash kodi"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              fullWidth
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '10px' },
                '& input': { fontSize: '1.5rem', letterSpacing: '0.4em', textAlign: 'center' },
              }}
            />
            <LoadingButton variant="contained" fullWidth loading={loading} onClick={handleVerifyOtp}>
              Tasdiqlash
            </LoadingButton>
            <Box className="flex items-center justify-between">
              <Button size="small" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} sx={{ textTransform: 'none' }}>
                ← Orqaga
              </Button>
              <Button size="small" onClick={handleResend} disabled={countdown > 0} sx={{ textTransform: 'none', color: countdown > 0 ? 'text.disabled' : 'primary.main' }}>
                {countdown > 0 ? `Qayta yuborish (${countdown}s)` : 'Qayta yuborish'}
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Button onClick={onBack} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>
        Email bilan kirish
      </Button>
    </motion.div>
  );
};

export default PhoneAuthForm;
