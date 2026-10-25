import { callStatusText, isSilentEnd } from '@suhbat/client';
import type { CallState } from '@suhbat/client';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import type { MediaStream } from 'react-native-webrtc';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/icon/Icon';
import type { IconName } from '../components/icon/Icon';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { useSession } from '../state/SessionProvider';
import { useCall, useNow, useSpeaker } from './useCall';

// Qo'ng'iroq ekrani doim qorong'i (video ustida o'qilsin); fon chuqurligi asosiy rangdan.
const COLORS = { text: '#ffffff', muted: 'rgba(255,255,255,0.75)', button: 'rgba(255,255,255,0.18)', active: '#ffffff', danger: '#E53935', accept: '#43A047' };

interface RoundProps {
  label:    string;
  icon:     IconName;
  onPress:  () => void;
  color?:   string;
  active?:  boolean;
  caption?: string;
  /** Go'shakni qo'yish belgisi — telefon ikonkasi 135° burilgan. */
  hangup?:  boolean;
}

const RoundButton = ({ label, icon, onPress, color, active = false, caption, hangup = false }: RoundProps) => (
  <View style={styles.control}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.round, { backgroundColor: color ?? (active ? COLORS.active : COLORS.button) }]}
    >
      <View style={hangup ? styles.hangup : undefined}>
        <Icon name={icon} size={28} color={active && !color ? '#111827' : COLORS.text} />
      </View>
    </Pressable>
    {caption ? <Text style={styles.caption}>{caption}</Text> : null}
  </View>
);

const Video = ({ stream, mirror, style }: { stream: MediaStream; mirror?: boolean; style: object }) => (
  <RTCView streamURL={stream.toURL()} mirror={mirror} objectFit="cover" style={style} zOrder={mirror ? 1 : 0} />
);

const Frame = ({ children }: { children: ReactNode }) => {
  const { palette } = useTheme();
  // Fon: qorong'i ko'k-qora + asosiy rangning xira tusi (mavzuga mos).
  return (
    <View style={[styles.overlay, { backgroundColor: '#0E1621' }]} accessibilityViewIsModal>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.primary, opacity: 0.18 }]} />
      {children}
    </View>
  );
};

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
        <RoundButton label="Rad etish" caption="Rad etish" icon="call" hangup color={COLORS.danger} onPress={() => calls.reject()} />
        <RoundButton
          label="Qabul qilish"
          caption="Qabul qilish"
          icon={state.media === 'video' ? 'videocam' : 'call'}
          color={COLORS.accept}
          onPress={() => void calls.accept()}
        />
      </View>
    </Frame>
  );
};

const Active = ({ state }: { state: CallState<MediaStream> }) => {
  const { services: { calls, callAudio } } = useSession();
  const speaker = useSpeaker();
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
          <RoundButton label="Yopish" caption="Yopish" icon="close" onPress={() => calls.dismiss()} />
        ) : (
          <>
            <RoundButton
              label={state.muted ? 'Mikrofonni yoqish' : 'Mikrofonni o\'chirish'}
              icon={state.muted ? 'mic-off-outline' : 'mic-outline'}
              active={state.muted}
              onPress={() => calls.setMuted(!state.muted)}
            />
            <RoundButton
              label={speaker ? 'Karnayni o\'chirish' : 'Karnayni yoqish'}
              icon={speaker ? 'volume-high-outline' : 'volume-mute-outline'}
              active={speaker}
              onPress={() => callAudio.setSpeaker(!speaker)}
            />
            {isVideo ? (
              <RoundButton
                label={state.cameraOff ? 'Kamerani yoqish' : 'Kamerani o\'chirish'}
                icon={state.cameraOff ? 'videocam-off-outline' : 'videocam-outline'}
                active={state.cameraOff}
                onPress={() => calls.setCameraOff(!state.cameraOff)}
              />
            ) : null}
            {isVideo && calls.canSwitchCamera ? (
              <RoundButton label="Kamerani almashtirish" icon="camera-reverse-outline" onPress={() => void calls.switchCamera()} />
            ) : null}
            <RoundButton label="Tugatish" icon="call" hangup color={COLORS.danger} onPress={() => calls.hangup()} />
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
  overlay:  { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between', zIndex: 10, elevation: 10 },
  header:   { alignItems: 'center', gap: space.md, paddingTop: 64, paddingHorizontal: space.xxl },
  name:     { ...textStyles.title, color: COLORS.text, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  status:   { ...textStyles.body, color: COLORS.muted, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  pip:      { position: 'absolute', right: space.lg, top: space.lg, width: 110, height: 150, borderRadius: radii.md, overflow: 'hidden' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: space.xxl, paddingBottom: space.huge, flexWrap: 'wrap' },
  control:  { alignItems: 'center', gap: space.sm },
  round:    { width: 64, height: 64, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  caption:  { ...textStyles.bodySmall, color: COLORS.muted },
  hangup:   { transform: [{ rotate: '135deg' }] },
});
