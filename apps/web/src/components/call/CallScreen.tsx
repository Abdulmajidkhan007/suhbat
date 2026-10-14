import React, { useEffect, useState } from 'react';
import { Box, Dialog, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CloseIcon from '@mui/icons-material/Close';
import { callStatusText } from '@suhbat/client';
import type { CallState } from '@suhbat/client';
import AvatarWithStatus from '../common/AvatarWithStatus';
import MediaView from './MediaView';

interface Props {
  state:           CallState<MediaStream>;
  canSwitchCamera: boolean;
  onHangup:        () => void;
  onToggleMute:    () => void;
  onToggleCamera:  () => void;
  onSwitchCamera:  () => void;
  onClose:         () => void;
}

/** Har soniyada qayta chizish (taymer) — faqat ulanganda. */
const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
};

interface ControlProps {
  label:    string;
  onClick:  () => void;
  active?:  boolean;
  danger?:  boolean;
  children: React.ReactNode;
}

const Control: React.FC<ControlProps> = ({ label, onClick, active = false, danger = false, children }) => (
  <Tooltip title={label}>
    <IconButton
      onClick={onClick}
      aria-label={label}
      aria-pressed={danger ? undefined : active}
      sx={{
        width:   56,
        height:  56,
        color:   danger || !active ? 'common.white' : 'grey.900',
        bgcolor: danger ? 'error.main' : active ? 'common.white' : 'rgba(255,255,255,0.16)',
        '&:hover': { bgcolor: danger ? 'error.dark' : active ? 'grey.200' : 'rgba(255,255,255,0.28)' },
      }}
    >
      {children}
    </IconButton>
  </Tooltip>
);

/** Chiquvchi/faol qo'ng'iroq ekrani: video yoki avatar, holat/taymer, boshqaruv tugmalari. */
const CallScreen: React.FC<Props> = ({
  state, canSwitchCamera, onHangup, onToggleMute, onToggleCamera, onSwitchCamera, onClose,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const now = useNow(state.phase === 'connected');
  const ended = state.phase === 'ended';
  const isVideo = state.media === 'video';
  const remoteVideo = isVideo && state.remoteStream !== null;
  const peer = state.peer;
  const status = callStatusText(state, now);

  return (
    <Dialog
      open
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      aria-label={`Qo'ng'iroq: ${peer?.displayName ?? ''}`}
      slotProps={{ paper: { sx: { bgcolor: 'grey.900', color: 'common.white', borderRadius: fullScreen ? 0 : '20px', overflow: 'hidden' } } }}
    >
      <Box className="relative flex flex-col items-center justify-between" sx={{ minHeight: fullScreen ? '100%' : 560, height: '100%' }}>
        {remoteVideo && state.remoteStream && (
          <MediaView stream={state.remoteStream} kind="video" label="Suhbatdosh videosi" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {!isVideo && state.remoteStream && <MediaView stream={state.remoteStream} kind="audio" label="Suhbatdosh ovozi" />}

        {ended && (
          <IconButton onClick={onClose} aria-label="Yopish" sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white', zIndex: 2 }}>
            <CloseIcon />
          </IconButton>
        )}

        <Box className="relative z-[1] flex flex-col items-center gap-3 pt-12 px-4 text-center" sx={remoteVideo ? { textShadow: '0 1px 4px rgba(0,0,0,0.6)' } : undefined}>
          {!remoteVideo && peer && (
            <AvatarWithStatus uid={peer.id} displayName={peer.displayName} photoURL={peer.photoUrl} showStatus={false} size={112} />
          )}
          <Typography variant="h5" noWrap sx={{ fontWeight: 700, maxWidth: '90vw' }}>{peer?.displayName}</Typography>
          <Typography variant="body1" role="status" aria-live="polite" sx={{ opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
            {status}
          </Typography>
        </Box>

        {isVideo && state.localStream && !ended && (
          <Box
            className="absolute right-3 top-3 sm:right-4 sm:top-4 z-[1] overflow-hidden rounded-xl shadow-lg"
            sx={{ width: { xs: 96, sm: 160 }, aspectRatio: '3 / 4', bgcolor: 'grey.800' }}
          >
            {state.cameraOff ? (
              <Box className="w-full h-full flex items-center justify-center"><VideocamOffIcon /></Box>
            ) : (
              <MediaView stream={state.localStream} kind="video" local label="Sizning kamerangiz" className="w-full h-full object-cover" />
            )}
          </Box>
        )}

        <Box className="relative z-[1] flex items-center justify-center gap-4 sm:gap-6 pb-10 pt-6 px-4 flex-wrap">
          {!ended && (
            <>
              <Control label={state.muted ? 'Mikrofonni yoqish' : 'Mikrofonni o\'chirish'} active={state.muted} onClick={onToggleMute}>
                {state.muted ? <MicOffIcon /> : <MicIcon />}
              </Control>
              {isVideo && (
                <Control label={state.cameraOff ? 'Kamerani yoqish' : 'Kamerani o\'chirish'} active={state.cameraOff} onClick={onToggleCamera}>
                  {state.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
                </Control>
              )}
              {isVideo && canSwitchCamera && (
                <Control label="Kamerani almashtirish" onClick={onSwitchCamera}>
                  <CameraswitchIcon />
                </Control>
              )}
              <Control label="Tugatish" danger onClick={onHangup}>
                <CallEndIcon />
              </Control>
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default CallScreen;
