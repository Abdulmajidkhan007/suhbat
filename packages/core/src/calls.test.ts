import { describe, expect, it } from 'vitest';
import {
  IceServersResponseSchema,
  WsCallIceSchema,
  WsCallInviteSchema,
  WsCallResumedSchema,
  CALL_RESUME_GRACE_MS,
  WsCallSdpSchema,
  callSummaryText,
  formatCallDuration,
} from './calls.js';
import { PushDataSchema } from './push.js';

const id = '7b0e5c8e-1f7a-4a7e-9a55-0d4c2c6e9f11';

describe('qo\'ng\'iroq sxemalari', () => {
  it('invite: callId UUID, media audio|video', () => {
    expect(WsCallInviteSchema.safeParse({ callId: id, chatId: id, media: 'video' }).success).toBe(true);
    expect(WsCallInviteSchema.safeParse({ callId: 'x', chatId: id, media: 'audio' }).success).toBe(false);
    expect(WsCallInviteSchema.safeParse({ callId: id, chatId: id, media: 'screen' }).success).toBe(false);
  });

  it('SDP: faqat offer/answer, bo\'sh emas, juda katta emas', () => {
    expect(WsCallSdpSchema.safeParse({ callId: id, description: { type: 'offer', sdp: 'v=0' } }).success).toBe(true);
    expect(WsCallSdpSchema.safeParse({ callId: id, description: { type: 'pranswer', sdp: 'v=0' } }).success).toBe(false);
    expect(WsCallSdpSchema.safeParse({ callId: id, description: { type: 'offer', sdp: '' } }).success).toBe(false);
    expect(
      WsCallSdpSchema.safeParse({ callId: id, description: { type: 'offer', sdp: 'a'.repeat(100_001) } }).success,
    ).toBe(false);
  });

  it('ICE: nomzod yoki null (tugadi)', () => {
    expect(WsCallIceSchema.safeParse({ callId: id, candidate: null }).success).toBe(true);
    expect(
      WsCallIceSchema.safeParse({ callId: id, candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } })
        .success,
    ).toBe(true);
    expect(WsCallIceSchema.safeParse({ callId: id, candidate: { sdpMid: '0' } }).success).toBe(false);
  });

  it('ICE serverlar javobi', () => {
    expect(
      IceServersResponseSchema.safeParse({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:t.uz:3478'], username: 'u', credential: 'c' }],
        ttlSeconds: 3600,
      }).success,
    ).toBe(true);
    expect(IceServersResponseSchema.safeParse({ iceServers: [{ urls: [] }], ttlSeconds: null }).success).toBe(false);
  });

  it('resume ack: callId UUID va peerConnected bool', () => {
    expect(WsCallResumedSchema.safeParse({ callId: id, peerConnected: true }).success).toBe(true);
    expect(WsCallResumedSchema.safeParse({ callId: id }).success).toBe(false);
    expect(WsCallResumedSchema.safeParse({ callId: 'x', peerConnected: false }).success).toBe(false);
    expect(CALL_RESUME_GRACE_MS).toBeGreaterThan(0);
  });

  it('push: qo\'ng\'iroq data', () => {
    expect(PushDataSchema.parse({ type: 'call', callId: id, chatId: id, media: 'audio' })).toMatchObject({ type: 'call' });
    expect(PushDataSchema.safeParse({ type: 'call', callId: id, chatId: id }).success).toBe(false);
  });
});

describe('formatCallDuration', () => {
  it('m:ss va h:mm:ss', () => {
    expect(formatCallDuration(0)).toBe('0:00');
    expect(formatCallDuration(192_400)).toBe('3:12');
    expect(formatCallDuration(3_725_000)).toBe('1:02:05');
    expect(formatCallDuration(-5)).toBe('0:00');
  });
});

describe('callSummaryText', () => {
  it('gaplashilgan — davomiylik bilan', () => {
    expect(callSummaryText('audio', 'hangup', 192_000)).toBe('📞 Qo\'ng\'iroq, 3:12');
    expect(callSummaryText('video', 'disconnected', 5_000)).toBe('🎥 Video qo\'ng\'iroq, 0:05');
  });

  it('gaplashilmagan — natija', () => {
    expect(callSummaryText('audio', 'missed', null)).toBe('📞 Javobsiz qo\'ng\'iroq');
    expect(callSummaryText('audio', 'busy', null)).toBe('📞 Javobsiz qo\'ng\'iroq');
    expect(callSummaryText('video', 'rejected', null)).toBe('🎥 Rad etilgan video qo\'ng\'iroq');
    expect(callSummaryText('audio', 'cancelled', null)).toBe('📞 Bekor qilingan qo\'ng\'iroq');
  });
});
