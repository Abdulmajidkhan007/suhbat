// Brauzer (veb va Electron) WebRTC adapterlari — `@suhbat/client` CallSession uchun.
import type { CallIceCandidate, CallMedia, CallSdp, IceServer } from '@suhbat/core';
import type { CallMediaDevices, PeerConnection, PeerEvents } from '@suhbat/client';

const toSdp = (d: RTCSessionDescriptionInit): CallSdp => {
  if ((d.type !== 'offer' && d.type !== 'answer') || !d.sdp) throw new Error('SDP yaratilmadi');
  return { type: d.type, sdp: d.sdp };
};

export const toIceCandidate = (c: RTCIceCandidate | null): CallIceCandidate | null => {
  if (!c || !c.candidate) return null;
  return { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment };
};

export const createBrowserPeer = (
  iceServers: IceServer[],
  events: PeerEvents<MediaStream>,
  Ctor: typeof RTCPeerConnection = RTCPeerConnection,
): PeerConnection<MediaStream> => {
  const pc = new Ctor({ iceServers });
  pc.onicecandidate = (e) => events.onIceCandidate(toIceCandidate(e.candidate));
  pc.ontrack = (e) => events.onRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
  pc.onconnectionstatechange = () => events.onConnectionState(pc.connectionState);
  return {
    addStream:            (stream) => stream.getTracks().forEach((t) => pc.addTrack(t, stream)),
    createOffer:          async (options) => toSdp(await pc.createOffer(options?.iceRestart ? { iceRestart: true } : undefined)),
    createAnswer:         async () => toSdp(await pc.createAnswer()),
    setLocalDescription:  (d) => pc.setLocalDescription(d),
    setRemoteDescription: (d) => pc.setRemoteDescription(d),
    addIceCandidate:      (c) => pc.addIceCandidate(c ?? undefined),
    close:                () => pc.close(),
  };
};

/** `getUserMedia` xatosini foydalanuvchiga tushunarli matnga aylantiradi. */
export const mediaErrorText = (e: unknown, media: CallMedia): string => {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  const device = media === 'video' ? 'mikrofon yoki kamera' : 'mikrofon';
  if (name === 'NotAllowedError' || name === 'SecurityError') return `${device[0]!.toUpperCase()}${device.slice(1)}ga ruxsat berilmadi`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `${device[0]!.toUpperCase()}${device.slice(1)} topilmadi`;
  if (name === 'NotReadableError') return `${device[0]!.toUpperCase()}${device.slice(1)} boshqa dastur tomonidan band`;
  return 'Mikrofon/kamerani yoqib bo\'lmadi';
};

export const browserMediaDevices = (devices: MediaDevices | undefined = navigator.mediaDevices): CallMediaDevices<MediaStream> => ({
  async getLocalStream(media) {
    // `mediaDevices` faqat xavfsiz kontekstda (HTTPS yoki localhost) bor.
    if (!devices?.getUserMedia) throw new Error('Qo\'ng\'iroq faqat HTTPS orqali ishlaydi');
    try {
      return await devices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: media === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (e) {
      throw new Error(mediaErrorText(e, media));
    }
  },
  stopStream:      (stream) => stream.getTracks().forEach((t) => t.stop()),
  setAudioEnabled: (stream, on) => stream.getAudioTracks().forEach((t) => { t.enabled = on; }),
  setVideoEnabled: (stream, on) => stream.getVideoTracks().forEach((t) => { t.enabled = on; }),
});
