import { describe, expect, it, vi } from 'vitest';
import { browserMediaDevices, createBrowserPeer, mediaErrorText } from './webrtc';

class FakeRtc {
  static last: FakeRtc;
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null;
  ontrack: ((e: { streams: unknown[]; track: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = 'new';
  added: unknown[] = [];
  remote: unknown = null;
  ice: unknown[] = [];
  constructor(readonly config: RTCConfiguration) { FakeRtc.last = this; }
  addTrack(t: unknown) { this.added.push(t); }
  async createOffer() { return { type: 'offer', sdp: 'v=0' }; }
  async createAnswer() { return { type: 'answer' }; }
  async setLocalDescription() {}
  async setRemoteDescription(d: unknown) { this.remote = d; }
  async addIceCandidate(c: unknown) { this.ice.push(c); }
  close() {}
}

describe('createBrowserPeer', () => {
  it('ICE serverlar, hodisalar va SDP xaritasi', async () => {
    const events = { onIceCandidate: vi.fn(), onRemoteStream: vi.fn(), onConnectionState: vi.fn() };
    const peer = createBrowserPeer([{ urls: 'stun:x' }], events, FakeRtc as unknown as typeof RTCPeerConnection);
    const rtc = FakeRtc.last;
    expect(rtc.config).toEqual({ iceServers: [{ urls: 'stun:x' }] });

    rtc.onicecandidate?.({ candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'u' } });
    rtc.onicecandidate?.({ candidate: null });
    expect(events.onIceCandidate.mock.calls).toEqual([
      [{ candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'u' }],
      [null],
    ]);
    const stream = { id: 's' };
    rtc.ontrack?.({ streams: [stream], track: {} });
    expect(events.onRemoteStream).toHaveBeenCalledWith(stream);
    rtc.connectionState = 'connected';
    rtc.onconnectionstatechange?.();
    expect(events.onConnectionState).toHaveBeenCalledWith('connected');

    expect(await peer.createOffer()).toEqual({ type: 'offer', sdp: 'v=0' });
    await expect(peer.createAnswer()).rejects.toThrow('SDP');
    await peer.addIceCandidate(null);
    expect(rtc.ice).toEqual([undefined]);
    peer.addStream({ getTracks: () => ['a', 'v'] } as unknown as MediaStream);
    expect(rtc.added).toEqual(['a', 'v']);
  });
});

describe('browserMediaDevices', () => {
  it('xavfsiz kontekst bo\'lmasa — tushunarli xato', async () => {
    await expect(browserMediaDevices(undefined).getLocalStream('audio')).rejects.toThrow('HTTPS');
  });

  it('video so\'rovi va ruxsat rad etilishi', async () => {
    const getUserMedia = vi.fn().mockResolvedValueOnce('stream').mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
    const devices = browserMediaDevices({ getUserMedia } as unknown as MediaDevices);
    expect(await devices.getLocalStream('video')).toBe('stream');
    expect(getUserMedia.mock.calls[0]?.[0]).toMatchObject({ video: { facingMode: 'user' } });
    await expect(devices.getLocalStream('audio')).rejects.toThrow('Mikrofonga ruxsat berilmadi');
  });

  it('xato matnlari', () => {
    expect(mediaErrorText(new DOMException('x', 'NotFoundError'), 'video')).toBe('Mikrofon yoki kamera topilmadi');
    expect(mediaErrorText(new DOMException('x', 'NotReadableError'), 'audio')).toBe('Mikrofon boshqa dastur tomonidan band');
    expect(mediaErrorText(new Error('?'), 'audio')).toBe('Mikrofon/kamerani yoqib bo\'lmadi');
  });
});
