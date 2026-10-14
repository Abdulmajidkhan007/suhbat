// react-native-webrtc adapterlari — `@suhbat/client` CallSession uchun (Android, iOS).
import type { CallMediaDevices, PeerConnection, PeerEvents } from '@suhbat/client';
import type { CallIceCandidate, CallMedia, CallSdp, IceServer } from '@suhbat/core';
import { PermissionsAndroid, Platform } from 'react-native';
import type { Permission } from 'react-native';
import { MediaStream, RTCPeerConnection, mediaDevices } from 'react-native-webrtc';

const toSdp = (d: { type?: string | null; sdp?: string | null }): CallSdp => {
  if ((d.type !== 'offer' && d.type !== 'answer') || !d.sdp) throw new Error('SDP yaratilmadi');
  return { type: d.type, sdp: d.sdp };
};

// Kutubxona `event-target-shim` tiplarini nashr qilmaydi — hodisa shakllari qo'lda.
interface IceEvent {
  candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null;
}
interface TrackEvent {
  streams: MediaStream[];
}

export const createNativePeer = (iceServers: IceServer[], events: PeerEvents<MediaStream>): PeerConnection<MediaStream> => {
  const pc = new RTCPeerConnection({ iceServers });
  pc.onicecandidate = (e: IceEvent) => {
    const c = e.candidate;
    events.onIceCandidate(c && c.candidate ? { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null } : null);
  };
  pc.ontrack = (e: TrackEvent) => {
    const stream = e.streams[0];
    if (stream) events.onRemoteStream(stream);
  };
  pc.onconnectionstatechange = () => events.onConnectionState(pc.connectionState);
  return {
    addStream:            (stream) => stream.getTracks().forEach((t) => pc.addTrack(t, stream)),
    createOffer:          async () => toSdp(await pc.createOffer({})),
    createAnswer:         async () => toSdp(await pc.createAnswer()),
    setLocalDescription:  (d) => pc.setLocalDescription(d),
    setRemoteDescription: (d) => pc.setRemoteDescription(d),
    addIceCandidate:      async (c: CallIceCandidate | null) => {
      if (c) await pc.addIceCandidate(c);
    },
    close: () => pc.close(),
  };
};

/**
 * Android'da ish vaqtida ruxsat (RECORD_AUDIO, video uchun CAMERA; Android 12+ BLUETOOTH_CONNECT —
 * bluetooth quloqchin uchun, ixtiyoriy). `false` — majburiy ruxsat berilmadi.
 */
export const requestCallPermissions = async (media: CallMedia): Promise<boolean> => {
  if (Platform.OS !== 'android') return true; // iOS: tizim `getUserMedia` da o'zi so'raydi (Info.plist matni)
  const P = PermissionsAndroid.PERMISSIONS;
  const required: Permission[] = [P.RECORD_AUDIO, ...(media === 'video' ? [P.CAMERA] : [])];
  const optional: Permission[] = typeof Platform.Version === 'number' && Platform.Version >= 31 ? [P.BLUETOOTH_CONNECT] : [];
  const result = await PermissionsAndroid.requestMultiple([...required, ...optional]);
  return required.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
};

export const nativeMediaDevices = (): CallMediaDevices<MediaStream> => ({
  async getLocalStream(media) {
    const denied = media === 'video' ? 'Mikrofon yoki kameraga ruxsat berilmadi' : 'Mikrofonga ruxsat berilmadi';
    if (!(await requestCallPermissions(media))) throw new Error(denied);
    try {
      return await mediaDevices.getUserMedia({
        audio: true,
        video: media === 'video' ? { facingMode: 'user', width: 1280, height: 720, frameRate: 30 } : false,
      });
    } catch {
      throw new Error(denied);
    }
  },
  stopStream:      (stream) => {
    stream.getTracks().forEach((t) => t.stop());
    stream.release();
  },
  setAudioEnabled: (stream, on) => stream.getAudioTracks().forEach((t) => { t.enabled = on; }),
  setVideoEnabled: (stream, on) => stream.getVideoTracks().forEach((t) => { t.enabled = on; }),
  // Old/orqa kamera: SDP qayta kelishuvisiz (`_switchCamera` — kutubxonaning o'z API'si).
  switchCamera:    async (stream) => stream.getVideoTracks().forEach((t) => t._switchCamera()),
});
