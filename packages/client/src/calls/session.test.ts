import type { CallIceCandidate, CallSdp, PublicUser, WsCallIncoming } from '@suhbat/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { createCallManager } from './manager.js';
import { CallSession, MEDIA_ERROR, uuidV4 } from './session.js';
import type { CallSignal } from './session.js';
import type { CallMediaDevices, CallSessionDeps, CallSignaling, PeerConnection, PeerEvents } from './types.js';

const ali: PublicUser = { id: '11111111-1111-4111-8111-111111111111', displayName: 'Ali', username: null, photoUrl: null, bio: null, createdAt: '2026-10-14T00:00:00.000Z' };
const vali: PublicUser = { ...ali, id: '22222222-2222-4222-8222-222222222222', displayName: 'Vali' };
const CHAT = '33333333-3333-4333-8333-333333333333';
const CALL = '44444444-4444-4444-8444-444444444444';

/** "Tarmoq": signal keyingi mikrovazifada yetkaziladi (haqiqiy socket kabi asinxron). */
const later = (fn: () => void) => void Promise.resolve().then(fn);
const flush = () => new Promise((r) => setTimeout(r, 0));

type Stream = { id: string; audio: boolean; video: boolean; stopped: boolean };

class FakePeer implements PeerConnection<Stream> {
  local: CallSdp | null = null;
  remote: CallSdp | null = null;
  added: Stream[] = [];
  ice: (CallIceCandidate | null)[] = [];
  closed = false;
  constructor(readonly name: string, readonly events: PeerEvents<Stream>, readonly iceServers: unknown) {}
  addStream(s: Stream) { this.added.push(s); }
  async createOffer(): Promise<CallSdp> { return { type: 'offer', sdp: `${this.name}-offer` }; }
  async createAnswer(): Promise<CallSdp> { return { type: 'answer', sdp: `${this.name}-answer` }; }
  async setLocalDescription(d: CallSdp) {
    this.local = d;
    later(() => this.events.onIceCandidate({ candidate: `candidate:${this.name}`, sdpMid: '0', sdpMLineIndex: 0 }));
    this.maybeConnect();
  }
  async setRemoteDescription(d: CallSdp) {
    if (d.sdp === 'buzuq') throw new Error('SDP yaroqsiz');
    this.remote = d;
    this.maybeConnect();
  }
  async addIceCandidate(c: CallIceCandidate | null) { this.ice.push(c); }
  close() { this.closed = true; }
  private maybeConnect() {
    if (!this.local || !this.remote) return;
    later(() => {
      this.events.onRemoteStream({ id: `remote-of-${this.name}`, audio: true, video: true, stopped: false });
      this.events.onConnectionState('connected');
    });
  }
}

const makeMedia = (deny = false) => {
  const streams: Stream[] = [];
  const media: CallMediaDevices<Stream> = {
    getLocalStream: vi.fn(async (kind) => {
      if (deny) throw new Error(MEDIA_ERROR);
      const s = { id: `local-${streams.length}`, audio: true, video: kind === 'video', stopped: false };
      streams.push(s);
      return s;
    }),
    stopStream:      (s) => { s.stopped = true; },
    setAudioEnabled: (s, on) => { s.audio = on; },
    setVideoEnabled: (s, on) => { s.video = on; },
  };
  return { media, streams };
};

type MockSignaling = { [K in keyof CallSignaling]: Mock<CallSignaling[K]> };
const makeSignaling = (): MockSignaling => ({
  inviteCall:     vi.fn<CallSignaling['inviteCall']>(async (p) => ({ callId: p.callId })),
  callRinging:    vi.fn<CallSignaling['callRinging']>(),
  acceptCall:     vi.fn<CallSignaling['acceptCall']>(async (callId) => ({ callId })),
  rejectCall:     vi.fn<CallSignaling['rejectCall']>(async (callId) => ({ callId })),
  cancelCall:     vi.fn<CallSignaling['cancelCall']>(async (callId) => ({ callId })),
  endCall:        vi.fn<CallSignaling['endCall']>(async (callId) => ({ callId })),
  sendCallOffer:  vi.fn<CallSignaling['sendCallOffer']>(),
  sendCallAnswer: vi.fn<CallSignaling['sendCallAnswer']>(),
  sendCallIce:    vi.fn<CallSignaling['sendCallIce']>(),
});

const deps = (name: string, signaling: CallSignaling, media: CallMediaDevices<Stream>, peers: FakePeer[]): CallSessionDeps<Stream> => ({
  signaling,
  media,
  createPeer:    (ice, events) => {
    const p = new FakePeer(name, events, ice);
    peers.push(p);
    return p;
  },
  getIceServers: async () => [{ urls: 'stun:stun.l.google.com:19302' }],
  newId:         () => CALL,
  now:           () => 1_000,
});

const invite = (media: 'audio' | 'video' = 'audio'): WsCallIncoming => ({
  callId: CALL, chatId: CHAT, media, from: ali, createdAt: '2026-10-14T00:00:00.000Z',
});

/** Ikki sessiyani soxta server orqali ulaydi (serverning asosiy qoidalari bilan). */
const pair = () => {
  const peers: FakePeer[] = [];
  const callerSig = makeSignaling();
  const calleeSig = makeSignaling();
  const callerMedia = makeMedia();
  const calleeMedia = makeMedia();
  const caller = new CallSession(deps('ali', callerSig, callerMedia.media, peers));
  const callee = new CallSession(deps('vali', calleeSig, calleeMedia.media, peers));
  const to = (s: CallSession<Stream>, signal: CallSignal) => later(() => void s.handleSignal(signal));

  callerSig.inviteCall.mockImplementation(async (p) => {
    later(() => callee.receive({ ...invite(p.media), callId: p.callId }));
    return { callId: p.callId };
  });
  calleeSig.callRinging.mockImplementation((callId: string) => to(caller, { type: 'ringing', callId }));
  calleeSig.acceptCall.mockImplementation(async (callId: string) => {
    to(caller, { type: 'accept', callId });
    return { callId };
  });
  calleeSig.rejectCall.mockImplementation(async (callId: string) => {
    to(caller, { type: 'end', callId, reason: 'rejected' });
    return { callId };
  });
  callerSig.cancelCall.mockImplementation(async (callId: string) => {
    to(callee, { type: 'end', callId, reason: 'cancelled' });
    return { callId };
  });
  callerSig.endCall.mockImplementation(async (callId: string) => {
    to(callee, { type: 'end', callId, reason: 'hangup' });
    return { callId };
  });
  calleeSig.endCall.mockImplementation(async (callId: string) => {
    to(caller, { type: 'end', callId, reason: 'hangup' });
    return { callId };
  });
  callerSig.sendCallOffer.mockImplementation((callId: string, description: CallSdp) => to(callee, { type: 'offer', callId, description }));
  calleeSig.sendCallAnswer.mockImplementation((callId: string, description: CallSdp) => to(caller, { type: 'answer', callId, description }));
  callerSig.sendCallIce.mockImplementation((callId: string, candidate: CallIceCandidate | null) => to(callee, { type: 'ice', callId, candidate }));
  calleeSig.sendCallIce.mockImplementation((callId: string, candidate: CallIceCandidate | null) => to(caller, { type: 'ice', callId, candidate }));

  return { caller, callee, callerSig, calleeSig, callerMedia, calleeMedia, peers };
};

describe('CallSession', () => {
  it('to\'liq oqim: calling → ringing → connecting → connected → ended (ikkala tomonda)', async () => {
    const { caller, callee, callerSig, calleeSig, callerMedia, calleeMedia, peers } = pair();
    const phases: string[] = [];
    caller.subscribe((s) => { if (phases.at(-1) !== s.phase) phases.push(s.phase); });

    await caller.start({ chatId: CHAT, peer: vali, media: 'video' });
    expect(callerSig.inviteCall).toHaveBeenCalledWith({ callId: CALL, chatId: CHAT, media: 'video' });
    expect(caller.getState()).toMatchObject({ phase: 'calling', direction: 'outgoing', peer: vali });
    expect(callerMedia.media.getLocalStream).toHaveBeenCalledWith('video');

    await flush();
    expect(callee.getState()).toMatchObject({ phase: 'ringing', direction: 'incoming', peer: ali, media: 'video' });
    expect(calleeSig.callRinging).toHaveBeenCalledWith(CALL);
    expect(calleeMedia.media.getLocalStream).not.toHaveBeenCalled(); // qabul qilinmaguncha kamera yoqilmaydi
    await flush();
    expect(caller.getState().remoteRinging).toBe(true);

    await callee.accept();
    await vi.waitFor(() => {
      expect(caller.getState().phase).toBe('connected');
      expect(callee.getState().phase).toBe('connected');
    });
    const [calleePeer, callerPeer] = peers as [FakePeer, FakePeer];
    expect(callerPeer.local).toEqual({ type: 'offer', sdp: 'ali-offer' });
    expect(calleePeer.remote).toEqual({ type: 'offer', sdp: 'ali-offer' });
    expect(callerPeer.remote).toEqual({ type: 'answer', sdp: 'vali-answer' });
    expect(callerPeer.added.map((s) => s.id)).toEqual(['local-0']);
    expect(callerPeer.iceServers).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
    await vi.waitFor(() => {
      expect(calleePeer.ice).toContainEqual(expect.objectContaining({ candidate: 'candidate:ali' }));
      expect(callerPeer.ice).toContainEqual(expect.objectContaining({ candidate: 'candidate:vali' }));
    });
    expect(caller.getState()).toMatchObject({ connectedAt: 1_000, remoteStream: { id: 'remote-of-ali' } });

    caller.hangup();
    expect(callerSig.endCall).toHaveBeenCalledWith(CALL);
    expect(caller.getState()).toMatchObject({ phase: 'ended', endReason: 'hangup', localStream: null });
    expect(callerMedia.streams[0]?.stopped).toBe(true);
    expect(callerPeer.closed).toBe(true);
    await vi.waitFor(() => expect(callee.getState()).toMatchObject({ phase: 'ended', endReason: 'hangup' }));
    expect(calleeMedia.streams[0]?.stopped).toBe(true);
    expect(phases).toEqual(['calling', 'connecting', 'connected', 'ended']);
  });

  it('remote description kelguncha ICE navbatda turadi', async () => {
    const sig = makeSignaling();
    const peers: FakePeer[] = [];
    const s = new CallSession(deps('vali', sig, makeMedia().media, peers));
    s.receive(invite());
    await s.accept();
    const cand = { candidate: 'candidate:early', sdpMid: '0', sdpMLineIndex: 0 };
    await s.handleSignal({ type: 'ice', callId: CALL, candidate: cand });
    expect(peers[0]?.ice).toEqual([]);
    await s.handleSignal({ type: 'offer', callId: CALL, description: { type: 'offer', sdp: 'x' } });
    expect(peers[0]?.ice).toEqual([cand]);
    expect(sig.sendCallAnswer).toHaveBeenCalledWith(CALL, { type: 'answer', sdp: 'vali-answer' });
  });

  it('rad etish va bekor qilish', async () => {
    const a = pair();
    await a.caller.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await flush();
    a.callee.reject();
    expect(a.calleeSig.rejectCall).toHaveBeenCalledWith(CALL);
    expect(a.callee.getState().endReason).toBe('rejected');
    await vi.waitFor(() => expect(a.caller.getState()).toMatchObject({ phase: 'ended', endReason: 'rejected' }));
    expect(a.callerMedia.streams[0]?.stopped).toBe(true);

    const b = pair();
    await b.caller.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await flush();
    b.caller.hangup(); // hali qabul qilinmagan — bekor
    expect(b.callerSig.cancelCall).toHaveBeenCalledWith(CALL);
    expect(b.callerSig.endCall).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(b.callee.getState().endReason).toBe('cancelled'));
  });

  it('band: call:busy — ended/busy; boshqa callId voqealari e\'tiborsiz', async () => {
    const sig = makeSignaling();
    const s = new CallSession(deps('ali', sig, makeMedia().media, []));
    await s.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await s.handleSignal({ type: 'busy', callId: 'boshqa' });
    expect(s.getState().phase).toBe('calling');
    await s.handleSignal({ type: 'busy', callId: CALL });
    expect(s.getState()).toMatchObject({ phase: 'ended', endReason: 'busy' });
  });

  it('mikrofon ruxsati yo\'q: chiquvchida invite yuborilmaydi; kiruvchida rad etiladi', async () => {
    const sig = makeSignaling();
    const out = new CallSession(deps('ali', sig, makeMedia(true).media, []));
    await out.start({ chatId: CHAT, peer: vali, media: 'audio' });
    expect(out.getState()).toMatchObject({ phase: 'ended', endReason: 'error', error: MEDIA_ERROR });
    expect(sig.inviteCall).not.toHaveBeenCalled();

    const sig2 = makeSignaling();
    const inc = new CallSession(deps('vali', sig2, makeMedia(true).media, []));
    inc.receive(invite());
    await inc.accept();
    expect(inc.getState().endReason).toBe('error');
    expect(sig2.rejectCall).toHaveBeenCalledWith(CALL);
    expect(sig2.acceptCall).not.toHaveBeenCalled();
  });

  it('ruxsat oynasi ochiqligida bekor qilinsa — olingan media darhol to\'xtatiladi', async () => {
    const sig = makeSignaling();
    const m = makeMedia();
    let grant!: () => void;
    const original = m.media.getLocalStream;
    m.media.getLocalStream = async (kind) => {
      await new Promise<void>((r) => { grant = r; });
      return original(kind);
    };
    const s = new CallSession(deps('ali', sig, m.media, []));
    const started = s.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await flush();
    s.hangup();
    grant();
    await started;
    expect(m.streams[0]?.stopped).toBe(true);
    expect(sig.inviteCall).not.toHaveBeenCalled();
    expect(s.getState().endReason).toBe('cancelled');
  });

  it('server invite\'ni rad etsa — xato matni bilan tugaydi, media to\'xtaydi', async () => {
    const sig = makeSignaling();
    sig.inviteCall.mockRejectedValueOnce(new Error('Bu foydalanuvchiga qo\'ng\'iroq qilib bo\'lmaydi (bloklangan)'));
    const m = makeMedia();
    const s = new CallSession(deps('ali', sig, m.media, []));
    await s.start({ chatId: CHAT, peer: vali, media: 'audio' });
    expect(s.getState()).toMatchObject({ phase: 'ended', endReason: 'error', error: expect.stringContaining('bloklangan') });
    expect(m.streams[0]?.stopped).toBe(true);
  });

  it('ICE failed yoki buzuq SDP — qo\'ng\'iroq tugaydi va serverga call:end', async () => {
    const sig = makeSignaling();
    const peers: FakePeer[] = [];
    const s = new CallSession(deps('ali', sig, makeMedia().media, peers));
    await s.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await s.handleSignal({ type: 'accept', callId: CALL });
    expect(sig.sendCallOffer).toHaveBeenCalled();
    await s.handleSignal({ type: 'answer', callId: CALL, description: { type: 'answer', sdp: 'buzuq' } });
    expect(s.getState()).toMatchObject({ phase: 'ended', endReason: 'failed' });
    expect(sig.endCall).toHaveBeenCalledWith(CALL);

    const sig2 = makeSignaling();
    const peers2: FakePeer[] = [];
    const s2 = new CallSession(deps('ali', sig2, makeMedia().media, peers2));
    await s2.start({ chatId: CHAT, peer: vali, media: 'audio' });
    await s2.handleSignal({ type: 'accept', callId: CALL });
    peers2[0]!.events.onConnectionState('connected');
    peers2[0]!.events.onConnectionState('disconnected');
    expect(s2.getState()).toMatchObject({ phase: 'connected', reconnecting: true });
    peers2[0]!.events.onConnectionState('connected');
    expect(s2.getState().reconnecting).toBe(false);
    peers2[0]!.events.onConnectionState('failed');
    expect(s2.getState()).toMatchObject({ phase: 'ended', endReason: 'failed' });
    expect(sig2.endCall).toHaveBeenCalledWith(CALL);
  });

  it('mikrofon/kamera o\'chirish trek\'larga ta\'sir qiladi', async () => {
    const m = makeMedia();
    const s = new CallSession(deps('ali', makeSignaling(), m.media, []));
    await s.start({ chatId: CHAT, peer: vali, media: 'video' });
    s.setMuted(true);
    s.setCameraOff(true);
    expect(m.streams[0]).toMatchObject({ audio: false, video: false });
    expect(s.getState()).toMatchObject({ muted: true, cameraOff: true });
    s.setMuted(false);
    expect(m.streams[0]?.audio).toBe(true);
    expect(s.canSwitchCamera).toBe(false);
  });

  it('uuidV4 formati', () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('createCallManager', () => {
  afterEach(() => vi.useRealTimers());

  const makeEvents = () => {
    const handlers = new Map<string, (p: unknown) => void>();
    return {
      on: vi.fn((event: string, l: (p: unknown) => void) => {
        handlers.set(event, l);
        return () => handlers.delete(event);
      }),
      fire: (event: string, payload: unknown) => handlers.get(event)?.(payload),
      handlers,
    };
  };

  it('kiruvchi: sessiya ochiladi, signal yo\'naltiriladi, tugagach biroz turib yopiladi', async () => {
    vi.useFakeTimers();
    const events = makeEvents();
    const sig = makeSignaling();
    const manager = createCallManager<Stream>({
      ...deps('vali', sig, makeMedia().media, []),
      events: events as never,
      endedLingerMs: 1000,
    });
    const seen: (string | null)[] = [];
    manager.subscribe((s) => seen.push(s?.phase ?? null));

    events.fire('call:invite', invite());
    expect(manager.getState()).toMatchObject({ phase: 'ringing', peer: ali });
    expect(sig.callRinging).toHaveBeenCalledWith(CALL);

    // Qayta ulanishda o'sha invite yana keldi — yangi sessiya ochilmaydi
    const session = manager.session;
    events.fire('call:invite', invite());
    expect(manager.session).toBe(session);

    events.fire('call:end', { callId: CALL, reason: 'cancelled', durationMs: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.getState()).toMatchObject({ phase: 'ended', endReason: 'cancelled' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.getState()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it('chiquvchi: band bo\'lsa ikkinchisi boshlanmaydi; dispose — tugatadi va obunalarni bekor qiladi', async () => {
    const events = makeEvents();
    const sig = makeSignaling();
    const manager = createCallManager<Stream>({ ...deps('ali', sig, makeMedia().media, []), events: events as never });
    await manager.startCall({ chatId: CHAT, peer: vali, media: 'audio' });
    await expect(manager.startCall({ chatId: CHAT, peer: vali, media: 'audio' })).rejects.toThrow('allaqachon');
    events.fire('call:accept', { callId: CALL });
    await vi.waitFor(() => expect(sig.sendCallOffer).toHaveBeenCalled());
    expect(manager.getState()?.phase).toBe('connecting');

    manager.dispose();
    expect(sig.endCall).toHaveBeenCalledWith(CALL);
    expect(events.handlers.size).toBe(0);
    expect(manager.getState()).toBeNull();
  });
});
