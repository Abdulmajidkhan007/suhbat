import React, { useState } from 'react';
import {
  Box, Typography, TextField, Divider, IconButton,
  Tooltip, Avatar, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setActivePanel } from '../../features/ui/uiSlice';
import { setUser } from '../../features/auth/authSlice';
import { setTheme } from '../../features/theme/themeSlice';
import { updateUserProfile } from '../../services/userService';
import { getAvatarColor } from '../../utils/colors';
import { getInitials } from '../../utils/formatters';
import { ThemeMode } from '../../types';
import toast from 'react-hot-toast';

const SettingsPanel: React.FC = () => {
  const dispatch   = useAppDispatch();
  const user       = useAppSelector((s) => s.auth.user)!;
  const mode       = useAppSelector((s) => s.theme.mode);
  const [name, setName]       = useState(user.displayName);
  const [saving, setSaving]   = useState(false);

  const hasChanges = name.trim() !== user.displayName && name.trim().length >= 2;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { displayName: name.trim() });
      dispatch(setUser({ ...user, displayName: name.trim() }));
      toast.success('Profile updated.');
    } catch {
      toast.error('Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const themes: { label: string; value: ThemeMode; icon: React.ReactNode }[] = [
    { label: 'Light', value: 'light', icon: <LightModeIcon fontSize="small" /> },
    { label: 'Dark',  value: 'dark',  icon: <DarkModeIcon  fontSize="small" /> },
  ];

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
          Settings
        </Typography>
        <IconButton size="small" onClick={() => dispatch(setActivePanel('chats'))}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Profile section */}
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
            Profile
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

            <Box className="w-full relative">
              <TextField
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
              {hasChanges && (
                <Tooltip title="Save name">
                  <IconButton
                    size="small"
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                      position:  'absolute',
                      right:     8,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                      bgcolor:   'primary.main',
                      color:     'white',
                      '&:hover': { bgcolor: 'primary.dark' },
                      width:     28,
                      height:    28,
                    }}
                  >
                    {saving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </div>

        <Divider />

        {/* Theme section */}
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem' }}>
            Appearance
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
            ChatApp v1.0.0
          </Typography>
          <Typography variant="caption" color="text.disabled" align="center" sx={{ display: 'block' }}>
            Built with React · Firebase · MUI
          </Typography>
        </div>
      </Box>
    </motion.div>
  );
};

export default SettingsPanel;
