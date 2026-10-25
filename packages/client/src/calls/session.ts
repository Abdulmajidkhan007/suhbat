import type {
  CallEndReason,
  CallIceCandidate,
  CallMedia,
  CallSdp,
  IceServer,
  WsCallIncoming,
} from '@suhbat/core';
import type {
  CallPeer,
  CallSessionDeps,
  CallSessionEndReason,
  CallState,
  PeerConnection,
  PeerConnectionState,
} from './types.js';

/** Server/socket'dan kelgan qo'ng'iroq voqeasi (`call:*`). */
export type CallSignal =
  | { type: 'ringing'; callId: string }
  | { type: 'accept'; callId: string }
  | { type: 'busy'; callId: string }
  | { type: 'end'; callId: string; reason: CallEndReason }
  | { type: 'offer'; callId: string; description: CallSdp }
  | { type: 'answer'; callId: string; description: CallSdp }
  | { type: 'ice'; callId: string; candidate: CallIceCandidate | null }
  /** Suhbatdosh signal kanalini qayta ulab qo'ng'iroqni tikladi. */
  | { type: 'resume'; callId: string };

/** Ketma-ket nechta ICE restart urinilgach (`failed`) qo'ng'iroq tugatiladi. */
export const MAX_ICE_RESTARTS = 2;

/** UUID v4: `crypto.randomUUID` bo'lmasa (Hermes) — `getRandomValues` yoki `Math.random`. */
export const uuidV4 = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export const MEDIA_ERROR = 'Mikrofon yoki kameraga ruxsat berilmadi';

/**
 * Bitta 1:1 qo'ng'iroq: holat mashinasi + WebRTC muzokarasi (offer/answer/ICE).
 * Platformaga bog'liq hamma narsa (`RTCPeerConnection`, `getUserMedia`, socket) injeksiya qilinadi.
 *
 * Chiquvchi: `start` → (media, ICE serverlar) → `call:invite` → `calling`; `call:accept`
 * kelganda peer yaratib offer yuboradi → `connecting`; ICE ulangach → `connected`.
 * Kiruvchi: `receive` → `ringing` (+ `call:ringing`); `accept` → media + peer → `call:accept`
 * → offer kelganda answer. Har qanday tugashda media to'xtatiladi va peer yopiladi.
 */
export class CallSession<S> {
  private state: CallState<S>;
  private readonly listeners = new Set<(state: CallState<S>) => void>();
  private peerConnection: PeerConnection<S> | null = null;
  private iceServers: IceServer[] = [];
  /** Remote description o'rnatilguncha kelgan ICE nomzodlar. */
  private pendingIce: (CallIceCandidate | null)[] = [];
  private remoteDescriptionSet = false;
  /** Server qo'ng'iroqni qabul qilingan deb biladi (chaqiruvchi: `call:accept` keldi; qabul qiluvchi: ack keldi). */
  private signalAccepted = false;
  /** Yuborilgan offer'ga javob (answer) kutilmoqda; kutilmagan answer e'tiborsiz qoldiriladi. */
  private awaitingAnswer = false;
  private iceRestarts = 0;
  private readonly now: () => number;

  constructor(private readonly deps: CallSessionDeps<S>) {
    this.now = deps.now ?? Date.now;
    this.state = {
      phase:         'idle',
      callId:        null,
      chatId:        null,
      media:         'audio',
      direction:     'outgoing',
      peer:          null,
      remoteRinging: false,
      reconnecting:  false,
      connectedAt:   null,
      muted:         false,
      cameraOff:     false,
      localStream:   null,
      remoteStream:  null,
      endReason:     null,
      error:         null,
    };
  }

  getState(): CallState<S> {
    return this.state;
  }

  get callId(): string | null {
    return this.state.callId;
  }

  get isActive(): boolean {
    return this.state.phase !== 'idle' && this.state.phase !== 'ended';
  }

  subscribe(listener: (state: CallState<S>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Chiquvchi qo'ng'iroq. Xato bo'lsa (ruxsat yo'q, server rad etdi) holat `ended` + `error`. */
  async start(input: { chatId: string; peer: CallPeer; media: CallMedia }): Promise<void> {
    if (this.state.phase !== 'idle') throw new Error('Qo\'ng\'iroq allaqachon boshlangan');
    const callId = (this.deps.newId ?? uuidV4)();
    this.update({ phase: 'calling', direction: 'outgoing', callId, chatId: input.chatId, peer: input.peer, media: input.media });
    if (!(await this.prepareMedia())) return;
    try {
      await this.deps.signaling.inviteCall({ callId, chatId: input.chatId, media: input.media });
    } catch (e) {
      this.finish('error', errorMessage(e, 'Qo\'ng\'iroq qilib bo\'lmadi'));
    }
  }

  /** Kiruvchi qo'ng'iroq (`call:invite`). Qurilma jiringlayotganini chaqiruvchiga bildiradi. */
  receive(invite: WsCallIncoming): void {
    if (this.state.phase !== 'idle') throw new Error('Sessiya band');
    this.update({
      phase:     'ringing',
      direction: 'incoming',
      callId:    invite.callId,
      chatId:    invite.chatId,
      peer:      invite.from,
      media:     invite.media,
    });
    this.deps.signaling.callRinging(invite.callId);
  }

  /** Kiruvchini qabul qilish: avval media va peer tayyorlanadi, keyin `call:accept`. */
  async accept(): Promise<void> {
    const { phase, direction, callId } = this.state;
    if (phase !== 'ringing' || direction !== 'incoming' || !callId) return;
    this.update({ phase: 'connecting' });
    if (!(await this.prepareMedia())) {
      // Ruxsat yo'q — chaqiruvchi kutib qolmasin.
      if (this.state.endReason === 'error') this.deps.signaling.rejectCall(callId).catch(() => undefined);
      return;
    }
    this.createPeer();
    try {
      await this.deps.signaling.acceptCall(callId);
      this.signalAccepted = true;
    } catch (e) {
      this.finish('error', errorMessage(e, 'Qo\'ng\'iroqqa ulanib bo\'lmadi'));
    }
  }

  reject(): void {
    const { phase, direction, callId } = this.state;
    if (phase !== 'ringing' || direction !== 'incoming' || !callId) return;
    this.deps.signaling.rejectCall(callId).catch(() => undefined);
    this.finish('rejected');
  }

  /** Holatga qarab: chiquvchi jiringlayotgan — bekor; kiruvchi — rad; gaplashayotgan — tugatish. */
  hangup(): void {
    const { phase, direction, callId } = this.state;
    if (!callId || !this.isActive) return;
    if (phase === 'ringing' && direction === 'incoming') return this.reject();
    if (phase === 'calling') {
      this.deps.signaling.cancelCall(callId).catch(() => undefined);
      return this.finish('cancelled');
    }
    this.deps.signaling.endCall(callId).catch(() => undefined);
    this.finish('hangup');
  }

  setMuted(muted: boolean): void {
    const stream = this.state.localStream;
    if (stream) this.deps.media.setAudioEnabled(stream, !muted);
    this.update({ muted });
  }

  setCameraOff(cameraOff: boolean): void {
    const stream = this.state.localStream;
    if (stream) this.deps.media.setVideoEnabled(stream, !cameraOff);
    this.update({ cameraOff });
  }

  get canSwitchCamera(): boolean {
    return this.state.media === 'video' && typeof this.deps.media.switchCamera === 'function';
  }

  async switchCamera(): Promise<void> {
    const stream = this.state.localStream;
    if (stream && this.deps.media.switchCamera) await this.deps.media.switchCamera(stream);
  }

  /** Socket voqeasi. Boshqa `callId` yoki tugagan sessiya uchun — e'tiborsiz. */
  async handleSignal(signal: CallSignal): Promise<void> {
    if (signal.callId !== this.state.callId || !this.isActive) return;
    const outgoing = this.state.direction === 'outgoing';
    switch (signal.type) {
      case 'ringing':
        if (outgoing && this.state.phase === 'calling') this.update({ remoteRinging: true });
        return;
      case 'busy':
        if (outgoing) this.finish('busy');
        return;
      case 'end':
        this.finish(signal.reason);
        return;
      case 'accept':
        if (outgoing && this.state.phase === 'calling') {
          this.signalAccepted = true;
          await this.sendOffer();
        }
        return;
      case 'offer':
        if (!outgoing) await this.answerOffer(signal.description);
        return;
      case 'answer':
        if (outgoing && this.peerConnection && this.awaitingAnswer) {
          this.awaitingAnswer = false;
          await this.guard(async (pc) => {
            await pc.setRemoteDescription(signal.description);
            await this.remoteDescriptionReady(pc);
          });
        }
        return;
      case 'resume':
        // Suhbatdosh qaytdi: offer beruvchi (chaqiruvchi) ICE'ni qayta boshlaydi.
        if (outgoing && this.peerConnection) await this.restartIce();
        return;
      case 'ice':
        if (!this.peerConnection || !this.remoteDescriptionSet) {
          this.pendingIce.push(signal.candidate);
          return;
        }
        await this.peerConnection.addIceCandidate(signal.candidate).catch(() => undefined);
        return;
    }
  }

  /**
   * Signal socket'i qayta ulandi. Qabul qilingan qo'ng'iroqda serverga `call:resume` yuboriladi
   * (server qo'ng'iroqni uzilishdan keyin qisqa muddat kutadi). Server rad etsa (muddat o'tgan) —
   * tugaydi. Chaqiruvchi suhbatdosh ulangan bo'lsa ICE restart qiladi; aks holda suhbatdosh
   * qaytganda `resume` signali keladi.
   */
  async resumeSignaling(): Promise<void> {
    const callId = this.state.callId;
    if (!callId || !this.isActive || !this.signalAccepted || !this.peerConnection) return;
    let resumed;
    try {
      resumed = await this.deps.signaling.resumeCall(callId);
    } catch (e) {
      if (this.isActive) this.finish('disconnected', errorMessage(e, 'Aloqa uzildi'));
      return;
    }
    if (!this.isActive) return;
    if (this.state.direction === 'outgoing' && resumed.peerConnected) await this.restartIce();
  }

  /** ICE restart: yangi offer (`iceRestart`). Faqat chaqiruvchi (offer beruvchi). */
  private async restartIce() {
    const pc = this.peerConnection;
    if (!pc || !this.isActive || !this.signalAccepted || this.state.direction !== 'outgoing') return;
    await this.guard(async () => {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.awaitingAnswer = true;
      if (this.isActive) this.deps.signaling.sendCallOffer(this.state.callId!, offer);
    }, pc);
  }

  /** Mikrofon/kamera va ICE serverlar. `false` — sessiya tugadi (xato yoki foydalanuvchi bekor qildi). */
  private async prepareMedia(): Promise<boolean> {
    let stream: S;
    try {
      const [s, ice] = await Promise.all([
        this.deps.media.getLocalStream(this.state.media),
        this.deps.getIceServers().catch((): IceServer[] => []),
      ]);
      stream = s;
      this.iceServers = ice;
    } catch (e) {
      this.finish('error', errorMessage(e, MEDIA_ERROR));
      return false;
    }
    if (!this.isActive) {
      // Ruxsat oynasi ochiq turganda qo'ng'iroq tugadi.
      this.deps.media.stopStream(stream);
      return false;
    }
    this.update({ localStream: stream });
    return true;
  }

  private createPeer(): PeerConnection<S> {
    const callId = this.state.callId!;
    const pc = this.deps.createPeer(this.iceServers, {
      onIceCandidate:    (c) => {
        if (this.isActive) this.deps.signaling.sendCallIce(callId, c);
      },
      onRemoteStream:    (stream) => {
        if (this.isActive) this.update({ remoteStream: stream });
      },
      onConnectionState: (s) => this.onConnectionState(s),
    });
    if (this.state.localStream) pc.addStream(this.state.localStream);
    this.peerConnection = pc;
    return pc;
  }

  private async sendOffer() {
    this.update({ phase: 'connecting', remoteRinging: false });
    const pc = this.createPeer();
    await this.guard(async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.awaitingAnswer = true;
      if (this.isActive) this.deps.signaling.sendCallOffer(this.state.callId!, offer);
    }, pc);
  }

  private async answerOffer(offer: CallSdp) {
    await this.guard(async (pc) => {
      await pc.setRemoteDescription(offer);
      await this.remoteDescriptionReady(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (this.isActive) this.deps.signaling.sendCallAnswer(this.state.callId!, answer);
    });
  }

  private async remoteDescriptionReady(pc: PeerConnection<S>) {
    this.remoteDescriptionSet = true;
    const queued = this.pendingIce.splice(0);
    for (const c of queued) await pc.addIceCandidate(c).catch(() => undefined);
  }

  /** WebRTC xatosi — qo'ng'iroq tugaydi (server va ikkinchi tomonga ham). */
  private async guard(fn: (pc: PeerConnection<S>) => Promise<void>, pc = this.peerConnection) {
    if (!pc) return;
    try {
      await fn(pc);
    } catch (e) {
      if (!this.isActive) return;
      this.deps.signaling.endCall(this.state.callId!).catch(() => undefined);
      this.finish('failed', errorMessage(e, 'Ulanishda xato'));
    }
  }

  private onConnectionState(s: PeerConnectionState) {
    if (!this.isActive) return;
    if (s === 'connected') {
      this.iceRestarts = 0;
      this.update({ phase: 'connected', reconnecting: false, connectedAt: this.state.connectedAt ?? this.now() });
    } else if (s === 'disconnected') {
      if (this.state.phase === 'connected') this.update({ reconnecting: true });
    } else if (s === 'failed') {
      // Bir marta ulangan qo'ng'iroq (tarmoq almashdi): avval ICE restart, ketma-ket MAX_ICE_RESTARTS dan keyin — tugatish.
      if (this.state.connectedAt !== null && this.iceRestarts < MAX_ICE_RESTARTS) {
        this.iceRestarts++;
        this.update({ reconnecting: true });
        void this.recoverMedia();
        return;
      }
      this.deps.signaling.endCall(this.state.callId!).catch(() => undefined);
      this.finish('failed', 'Ulanish uzildi');
    }
  }

  /** Media yo'li uzildi: chaqiruvchi o'zi restart qiladi, qabul qiluvchi chaqiruvchidan so'raydi (`call:resume`). */
  private async recoverMedia() {
    if (this.state.direction === 'outgoing') return this.restartIce();
    const callId = this.state.callId;
    if (callId) await this.deps.signaling.resumeCall(callId).catch(() => undefined);
  }

  private finish(reason: CallSessionEndReason, error: string | null = null) {
    if (this.state.phase === 'ended') return;
    this.peerConnection?.close();
    this.peerConnection = null;
    this.pendingIce = [];
    this.awaitingAnswer = false;
    if (this.state.localStream) this.deps.media.stopStream(this.state.localStream);
    this.update({
      phase:         'ended',
      endReason:     reason,
      error,
      localStream:   null,
      remoteStream:  null,
      remoteRinging: false,
      reconnecting:  false,
    });
  }

  private update(patch: Partial<CallState<S>>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }
}
