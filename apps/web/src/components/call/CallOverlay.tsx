import React from 'react';
import { isSilentEnd } from '@suhbat/client';
import { useCall } from '../../hooks/useCall';
import { callManager } from '../../services/calls';
import CallScreen from './CallScreen';
import IncomingCallDialog from './IncomingCallDialog';

/**
 * Qo'ng'iroq UI: kiruvchi oynasi yoki qo'ng'iroq ekrani. Ilovaning kirilgan qismida bitta.
 * Javob berilmagan kiruvchi qo'ng'iroq tugasa (bekor/boshqa qurilmada) — ekran ko'rsatilmaydi.
 */
const CallOverlay: React.FC = () => {
  const state = useCall();
  if (!state || !state.peer) return null;

  if (state.phase === 'ringing' && state.direction === 'incoming') {
    return (
      <IncomingCallDialog
        open
        peer={state.peer}
        media={state.media}
        onAccept={() => void callManager.accept()}
        onReject={() => callManager.reject()}
      />
    );
  }

  if (isSilentEnd(state)) return null;

  return (
    <CallScreen
      state={state}
      canSwitchCamera={callManager.canSwitchCamera}
      onHangup={() => callManager.hangup()}
      onToggleMute={() => callManager.setMuted(!state.muted)}
      onToggleCamera={() => callManager.setCameraOff(!state.cameraOff)}
      onSwitchCamera={() => void callManager.switchCamera()}
      onClose={() => callManager.dismiss()}
    />
  );
};

export default CallOverlay;
