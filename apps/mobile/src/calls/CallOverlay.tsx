import { callStatusText, isSilentEnd } from '@suhbat/client';
import type { CallState } from '@suhbat/client';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { MediaStream } from 'react-native-webrtc';
import { Avatar } from '../components/Avatar';
import { useSession } from '../state/SessionProvider';
import { useCall, useNow } from './useCall';

const COLORS = { bg: '#111827', text: '#ffffff', muted: 'rgba(255,255,255,0.75)', button: 'rgba(255,255,255,0.18)', active: '#ffffff', danger: '#dc2626', accept: '#16a34a' };

interface RoundProps {
  label:    string;
  icon:     string;
  onPress:  () => void;
  color?:   string;
  active?:  boolean;
  caption?: string;
}

const RoundButton = ({ label, icon, onPress, color, active = false, caption }: RoundProps) => (
  <View style={styles.control}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.round, { backgroundColor: color ?? (active ? COLORS.active : COLORS.button) }]}
    >
      <Text style={[styles.icon, active && !color && styles.iconActive]}>{icon}</Text>
    </Pressable>
    {caption ? <Text style={styles.caption}>{caption}</Text> : null}
  </View>
);

const Video = ({ stream, mirror, style }: { stream: MediaStream; mirror?: boolean; style: object }) => (
  <RTCView streamURL={stream.toURL()} mirror={mirror} objectFit="cover" style={style} zOrder={mirror ? 1 : 0} />
);

const Frame = ({ children }: { children: ReactNode }) => (
  <View style={styles.overlay} accessibilityViewIsModal>{children}</View>
);

const Incoming = ({ state }: { state: CallState<MediaStream> }) => {
  const { services: { calls } } = useSession();
  return (
    <Frame>
      <View style={styles.header}>
        <Avatar name={state.peer?.displayName ?? '?'} size={112} />
        <Text style={styles.name} numberOfLines={1}>{state.peer?.displayName}</Text>
        <Text style={styles.status}>{callStatusText(state, Date.now())}</Text>
      </View>
      <View style={styles.controls}>
        <RoundButton label="Rad etish" caption="Rad etish" icon="✕" color={COLORS.danger} onPress={() => calls.reject()} />
        <RoundButton
          label="Qabul qilish"
          caption="Qabul qilish"
          icon={state.media === 'video' ? '🎥' : '📞'}
          color={COLORS.accept}
          onPress={() => void calls.accept()}
        />
      </View>
    </Frame>
  );
};

const Active = ({ state }: { state: CallState<MediaStream> }) => {
  const { services: { calls } } = useSession();
  const now = useNow(state.phase === 'connected');
  const ended = state.phase === 'ended';
  const isVideo = state.media === 'video';
  const remote = isVideo && state.remoteStream ? state.remoteStream : null;
  return (
    <Frame>
      {remote ? <Video stream={remote} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.header}>
        {!remote ? <Avatar name={state.peer?.displayName ?? '?'} size={112} /> : null}
        <Text style={styles.name} numberOfLines={1}>{state.peer?.displayName}</Text>
        <Text style={styles.status} accessibilityLiveRegion="polite">{callStatusText(state, now)}</Text>
      </View>
      {isVideo && state.localStream && !state.cameraOff && !ended ? (
        <Video stream={state.localStream} mirror style={styles.pip} />
      ) : null}
      <View style={styles.controls}>
        {ended ? (
          <RoundButton label="Yopish" caption="Yopish" icon="✕" onPress={() => calls.dismiss()} />
        ) : (
          <>
            <RoundButton
              label={state.muted ? 'Mikrofonni yoqish' : 'Mikrofonni o\'chirish'}
              icon="🎤"
              active={state.muted}
              onPress={() => calls.setMuted(!state.muted)}
            />
            {isVideo ? (
              <RoundButton
                label={state.cameraOff ? 'Kamerani yoqish' : 'Kamerani o\'chirish'}
                icon="📷"
                active={state.cameraOff}
                onPress={() => calls.setCameraOff(!state.cameraOff)}
              />
            ) : null}
            {isVideo && calls.canSwitchCamera ? (
              <RoundButton label="Kamerani almashtirish" icon="🔄" onPress={() => void calls.switchCamera()} />
            ) : null}
            <RoundButton label="Tugatish" icon="✕" color={COLORS.danger} onPress={() => calls.hangup()} />
          </>
        )}
      </View>
    </Frame>
  );
};

/**
 * Qo'ng'iroq ekrani — boshqa ekranlar ustida. Android "orqaga" tugmasi qo'ng'iroq paytida
 * ekrandan chiqarmaydi. Javob berilmagan kiruvchi qo'ng'iroq tugasa — ko'rsatilmaydi.
 */
export const CallOverlay = () => {
  const state = useCall();
  const visible = state !== null && state.peer !== null && !isSilentEnd(state);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  if (!state || !visible) return null;
  if (state.phase === 'ringing' && state.direction === 'incoming') return <Incoming state={state} />;
  return <Active state={state} />;
};

const styles = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: COLORS.bg, justifyContent: 'space-between', zIndex: 10, elevation: 10 },
  header:   { alignItems: 'center', gap: spacing(3), paddingTop: spacing(16), paddingHorizontal: spacing(6) },
  name:     { color: COLORS.text, fontSize: fontSize.xl, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  status:   { color: COLORS.muted, fontSize: fontSize.md, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  pip:      { position: 'absolute', right: spacing(4), top: spacing(4), width: 110, height: 150, borderRadius: radius.md, overflow: 'hidden' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: spacing(6), paddingBottom: spacing(12), flexWrap: 'wrap' },
  control:  { alignItems: 'center', gap: spacing(2) },
  round:    { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 26, color: COLORS.text },
  iconActive: { opacity: 0.6 },
  caption:  { color: COLORS.muted, fontSize: fontSize.sm },
});
