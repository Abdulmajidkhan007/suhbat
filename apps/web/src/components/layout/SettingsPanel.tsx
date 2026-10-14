import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Divider, IconButton, Avatar, Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BIO_MAX, DISPLAY_NAME_MAX, UpdateProfileInputSchema } from '@suhbat/core';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setActivePanel } from '../../features/ui/uiSlice';
import { setTheme } from '../../features/theme/themeSlice';
import { userUpdated } from '../../features/auth/authSlice';
import { api } from '../../services/api';
import { toAppUser } from '../../services/apiMappers';
import { errorText } from '../../utils/errors';
import { getAvatarColor } from '../../utils/colors';
import { getInitials } from '../../utils/formatters';
import { ThemeMode } from '../../types';

const SettingsPanel: React.FC = () => {
  const dispatch   = useAppDispatch();
  const user       = useAppSelector((s) => s.auth.user)!;
  const mode       = useAppSelector((s) => s.theme.mode);
  const themes: { label: string; value: ThemeMode; icon: React.ReactNode }[] = [
    { label: 'Yorug\'',   value: 'light', icon: <LightModeIcon fontSize="small" /> },
    { label: 'Qorong\'i', value: 'dark',  icon: <DarkModeIcon  fontSize="small" /> },
  ];

  const [name, setName] = useState(user.displayName);
  const [bio, setBio]   = useState(user.bio ?? '');
  const [saving, setSaving] = useState(false);

  // Server (yoki boshqa tab) yangilaganda maydonlar tiklanadi.
  useEffect(() => {
    setName(user.displayName);
    setBio(user.bio ?? '');
  }, [user.displayName, user.bio]);

  const parsed  = UpdateProfileInputSchema.safeParse({ displayName: name, bio });
  const dirty   = name.trim() !== user.displayName || bio.trim() !== (user.bio ?? '');
  const nameErr = name.trim().length === 0 ? 'Ism bo\'sh bo\'lmasin' : undefined;

  const save = async () => {
    if (!parsed.success || !dirty) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile(parsed.data);
      dispatch(userUpdated(toAppUser(updated)));
      toast.success('Profil saqlandi');
    } catch (e) {
      toast.error(errorText(e, 'Profilni saqlab bo\'lmadi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{    opacity: 0, x: 20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col h-full"
      style={{ background: 'var(--background-paper)' }}
    >
      {/* Header */}
      <Box
        className="flex items-center justify-between px-4 py-3 border-b"
        sx={{ borderColor: 'divider', minHeight: 64, flexShrink: 0 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sozlamalar
        </Typography>
        <IconButton size="small" onClick={() => dispatch(setActivePanel('chats'))} aria-label="Yopish">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Profile section */}
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
            Profil
          </Typography>
          <Box className="flex flex-col items-center gap-3 mt-3">
            <Avatar
              src={user.photoURL ?? undefined}
              sx={{
                width:   72,
                height:  72,
                bgcolor: getAvatarColor(user.uid),
                fontWeight: 700,
                fontSize: '1.5rem',
              }}
            >
              {!user.photoURL && getInitials(user.displayName)}
            </Avatar>

            <TextField
              label="Ism"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              error={Boolean(nameErr)}
              helperText={nameErr}
              slotProps={{ htmlInput: { maxLength: DISPLAY_NAME_MAX } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <TextField
              label="Men haqimda"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              fullWidth
              size="small"
              multiline
              maxRows={4}
              helperText={`${bio.length}/${BIO_MAX}`}
              slotProps={{ htmlInput: { maxLength: BIO_MAX } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            <Button
              variant="contained"
              fullWidth
              disabled={!dirty || !parsed.success || saving}
              onClick={() => void save()}
              sx={{ textTransform: 'none', borderRadius: '10px' }}
            >
              {saving ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>

            <Typography variant="caption" color="text.secondary">
              {user.email ?? ''}
            </Typography>
          </Box>
        </div>

        <Divider />

        {/* Theme section */}
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
            {'Ko\'rinish'}
          </Typography>
          <Box className="flex gap-3 mt-3">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => dispatch(setTheme(t.value))}
                className={`
                  flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer
                  ${mode === t.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-transparent bg-gray-100 dark:bg-gray-800 hover:border-gray-300'
                  }
                `}
                style={{ background: 'none' }}
                aria-pressed={mode === t.value}
              >
                <Box sx={{ color: mode === t.value ? 'primary.main' : 'text.secondary' }}>
                  {t.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: mode === t.value ? 700 : 500, color: mode === t.value ? 'primary.main' : 'text.secondary' }}
                >
                  {t.label}
                </Typography>
              </button>
            ))}
          </Box>
        </div>

        <Divider />

        {/* App info */}
        <div className="mt-auto">
          <Typography variant="caption" color="text.disabled" align="center" sx={{ display: 'block' }}>
            Suhbat v{__APP_VERSION__}
          </Typography>
        </div>
      </Box>
    </motion.div>
  );
};

export default SettingsPanel;
