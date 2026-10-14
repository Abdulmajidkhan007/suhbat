import type {
  CallEndReason,
  CallIceCandidate,
  CallMedia,
  CallSdp,
  IceServer,
  PublicUser,
  WsCallInvite,
  WsCallRef,
} from '@suhbat/core';

// Platformadan mustaqil qo'ng'iroq mantiqi uchun tashqi bog'liqliklar. Veb/desktop
// brauzer `RTCPeerConnection` ni, mobil `react-native-webrtc` ni shu interfeyslarga
// moslaydi (adapter). `S` — platformaning media oqimi turi (`MediaStream`).

/** idle → calling (chiquvchi) / ringing (kiruvchi) → connecting → connected → ended. */
export type CallPhase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallDirection = 'outgoing' | 'incoming';

/**
 * Server sabablari + mijozdagilar: `failed` — media ulanishi (ICE) o'rnatilmadi/uzildi;
 * `error` — mikrofon/kameraga ruxsat yo'q yoki signal xatosi (`error` maydonida matn).
 */
export type CallSessionEndReason = CallEndReason | 'failed' | 'error';

export interface CallState<S> {
  phase:         CallPhase;
  callId:        string | null;
  chatId:        string | null;
  media:         CallMedia;
  direction:     CallDirection;
  /** Suhbatdosh. */
  peer:          PublicUser | null;
  /** Chiquvchi: qabul qiluvchining qurilmasi jiringlayapti (`call:ringing` keldi). */
  remoteRinging: boolean;
  /** Media ulanishi uzilib, qayta tiklanmoqda (ICE `disconnected`). */
  reconnecting:  boolean;
  /** Media ulangan payt (taymer uchun), mijoz soati. */
  connectedAt:   number | null;
  muted:         boolean;
  cameraOff:     boolean;
  localStream:   S | null;
  remoteStream:  S | null;
  endReason:     CallSessionEndReason | null;
  error:         string | null;
}

/** Signal kanali — `createSocketClient` natijasi shu interfeysga tabiiy mos keladi. */
export interface CallSignaling {
  inviteCall(payload: WsCallInvite): Promise<WsCallRef>;
  callRinging(callId: string): void;
  acceptCall(callId: string): Promise<WsCallRef>;
  rejectCall(callId: string): Promise<WsCallRef>;
  cancelCall(callId: string): Promise<WsCallRef>;
  endCall(callId: string): Promise<WsCallRef>;
  sendCallOffer(callId: string, description: CallSdp): void;
  sendCallAnswer(callId: string, description: CallSdp): void;
  sendCallIce(callId: string, candidate: CallIceCandidate | null): void;
}

export type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface PeerEvents<S> {
  /** Mahalliy ICE nomzod (`null` — tugadi). */
  onIceCandidate(candidate: CallIceCandidate | null): void;
  onRemoteStream(stream: S): void;
  onConnectionState(state: PeerConnectionState): void;
}

/** `RTCPeerConnection` ustidagi yupqa adapter (platforma yozadi). */
export interface PeerConnection<S> {
  addStream(stream: S): void;
  createOffer(): Promise<CallSdp>;
  createAnswer(): Promise<CallSdp>;
  setLocalDescription(description: CallSdp): Promise<void>;
  setRemoteDescription(description: CallSdp): Promise<void>;
  addIceCandidate(candidate: CallIceCandidate | null): Promise<void>;
  close(): void;
}

export type CreatePeer<S> = (iceServers: IceServer[], events: PeerEvents<S>) => PeerConnection<S>;

/** Mikrofon/kamera (platforma: `getUserMedia` / `mediaDevices`). */
export interface CallMediaDevices<S> {
  /** Ruxsat so'raydi; rad etilsa xato (matni foydalanuvchiga ko'rsatiladi). */
  getLocalStream(media: CallMedia): Promise<S>;
  stopStream(stream: S): void;
  setAudioEnabled(stream: S, enabled: boolean): void;
  setVideoEnabled(stream: S, enabled: boolean): void;
  /** Old/orqa kamera (mobil). Bo'lmasa UI tugmani ko'rsatmaydi. */
  switchCamera?(stream: S): Promise<void>;
}

export interface CallSessionDeps<S> {
  signaling:     CallSignaling;
  media:         CallMediaDevices<S>;
  createPeer:    CreatePeer<S>;
  getIceServers: () => Promise<IceServer[]>;
  /** UUID v4 (standart — `crypto.randomUUID`). */
  newId?:        () => string;
  now?:          () => number;
}
