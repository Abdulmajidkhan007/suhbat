import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TURN_TTL_SECONDS, buildIceServers, readIceConfig } from './ice-servers';

const env = (vars: Record<string, string>) => readIceConfig((k) => vars[k]);

describe('ICE serverlar', () => {
  it('standart: faqat Google STUN; STUN_URLS bo\'sh — STUN yo\'q', () => {
    expect(buildIceServers(env({}), 'u1')).toEqual({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      ttlSeconds: null,
    });
    expect(buildIceServers(env({ STUN_URLS: '' }), 'u1')).toEqual({ iceServers: [], ttlSeconds: null });
  });

  it('doimiy TURN credential', () => {
    const res = buildIceServers(
      env({ TURN_URLS: 'turn:t.uz:3478?transport=udp, turns:t.uz:5349', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' }),
      'u1',
    );
    expect(res.iceServers[1]).toEqual({
      urls:       ['turn:t.uz:3478?transport=udp', 'turns:t.uz:5349'],
      username:   'u',
      credential: 'p',
    });
    expect(res.ttlSeconds).toBeNull();
  });

  it('TURN_SECRET: coturn REST credential (vaqtinchalik, foydalanuvchiga xos)', () => {
    const now = Date.UTC(2026, 9, 14);
    const res = buildIceServers(env({ TURN_URLS: 'turn:t.uz:3478', TURN_SECRET: 's3cr3t', TURN_TTL_SECONDS: '600' }), 'u1', now);
    const expiry = now / 1000 + 600;
    expect(res.ttlSeconds).toBe(600);
    expect(res.iceServers[1]).toEqual({
      urls:       ['turn:t.uz:3478'],
      username:   `${expiry}:u1`,
      credential: createHmac('sha1', 's3cr3t').update(`${expiry}:u1`).digest('base64'),
    });
    // Secret javobda yo'q
    expect(JSON.stringify(res)).not.toContain('s3cr3t');
  });

  it('yaroqsiz TTL — standart', () => {
    expect(env({ TURN_TTL_SECONDS: 'abc' }).turnTtlSeconds).toBe(DEFAULT_TURN_TTL_SECONDS);
    expect(env({ TURN_TTL_SECONDS: '-5' }).turnTtlSeconds).toBe(DEFAULT_TURN_TTL_SECONDS);
  });
});
