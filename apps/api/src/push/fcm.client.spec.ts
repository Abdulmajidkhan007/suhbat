import type { ConfigService } from '@nestjs/config';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FcmClient, buildFcmPayload, classifyFcmError, parseServiceAccount, signAssertion } from './fcm.client';
import type { FcmMessage } from './fcm.client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const account = { project_id: 'suhbat-test', client_email: 'push@suhbat-test.iam.gserviceaccount.com', private_key: pem };
const config = (value?: string) => ({ get: () => value }) as unknown as ConfigService;
const msg: FcmMessage = {
  notification: { title: 'Ali', body: 'salom' },
  data:         { type: 'message', chatId: 'c', messageId: 'm' },
  threadId:     'c',
};
const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('parseServiceAccount', () => {
  it('bo\'sh — null (push o\'chiq)', () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount('  ')).toBeNull();
  });

  it('xom JSON va base64 ni o\'qiydi, `\\n` ni qator ko\'chishiga aylantiradi', () => {
    const raw = JSON.stringify({ ...account, private_key: pem.replace(/\n/g, '\\n') });
    expect(parseServiceAccount(raw)?.private_key).toBe(pem);
    const b64 = Buffer.from(JSON.stringify(account)).toString('base64');
    expect(parseServiceAccount(b64)).toMatchObject({ project_id: 'suhbat-test', token_uri: 'https://oauth2.googleapis.com/token' });
  });

  it('yaroqsiz qiymat — xato', () => {
    expect(() => parseServiceAccount('{"project_id":"x"}')).toThrow();
    expect(() => parseServiceAccount('{buzuq')).toThrow();
  });
});

describe('signAssertion', () => {
  it('RS256 imzosi va claim\'lar to\'g\'ri', () => {
    const acc = parseServiceAccount(JSON.stringify(account))!;
    const jwt = signAssertion(acc, 1_700_000_000_000);
    const [h, c, sig] = jwt.split('.') as [string, string, string];
    const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'));
    expect(ok).toBe(true);
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      iss:   account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud:   'https://oauth2.googleapis.com/token',
      iat:   1_700_000_000,
      exp:   1_700_003_600,
    });
  });
});

describe('buildFcmPayload', () => {
  const base: FcmMessage = { notification: { title: 't', body: 'b' }, data: { type: 'message' }, threadId: 'chat-1' };

  it('standart: messages kanali, TTL yo\'q', () => {
    const { message } = buildFcmPayload('tok', base);
    expect(message.android).toEqual({
      priority:     'HIGH',
      notification: { channel_id: 'messages', tag: 'chat-1', sound: 'default' },
    });
    expect(message.apns.headers).toEqual({ 'apns-priority': '10' });
  });

  it('qo\'ng\'iroq: calls kanali, Android ttl va APNs expiration', () => {
    const { message } = buildFcmPayload('tok', { ...base, channelId: 'calls', ttlSeconds: 45 }, 1_000_000);
    expect(message.android).toMatchObject({ ttl: '45s', notification: { channel_id: 'calls' } });
    expect(message.apns.headers).toEqual({ 'apns-priority': '10', 'apns-expiration': String(1000 + 45) });
  });
});

describe('classifyFcmError', () => {
  const err = (errorCode: string, message = '') => ({
    error: { message, details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode }] },
  });

  it('UNREGISTERED, 404, SENDER_ID_MISMATCH, buzuq token — invalid', () => {
    expect(classifyFcmError(404, null)).toBe('invalid');
    expect(classifyFcmError(404, err('UNREGISTERED'))).toBe('invalid');
    expect(classifyFcmError(403, err('SENDER_ID_MISMATCH'))).toBe('invalid');
    expect(classifyFcmError(400, err('INVALID_ARGUMENT', 'The registration token is not a valid FCM registration token'))).toBe('invalid');
  });

  it('vaqtinchalik va payload xatolari — error (token qoladi)', () => {
    expect(classifyFcmError(429, err('QUOTA_EXCEEDED'))).toBe('error');
    expect(classifyFcmError(503, err('UNAVAILABLE'))).toBe('error');
    expect(classifyFcmError(400, err('INVALID_ARGUMENT', 'Invalid JSON payload'))).toBe('error');
  });
});

describe('FcmClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('env yo\'q — o\'chiq, tarmoqqa chiqmaydi', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const client = new FcmClient(config(undefined));
    expect(client.enabled).toBe(false);
    expect(await client.send('t', msg)).toBe('error');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('yaroqsiz env — o\'chiq, konstruktor yiqilmaydi', () => {
    expect(new FcmClient(config('{buzuq')).enabled).toBe(false);
  });

  it('access token bir marta olinadi va keshlanadi; xabar to\'g\'ri manzilga', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) return res(200, { access_token: 'at-1', expires_in: 3600 });
      return res(200, { name: 'projects/suhbat-test/messages/1' });
    }));
    const client = new FcmClient(config(JSON.stringify(account)));
    await expect(Promise.all([client.send('tok-1', msg), client.send('tok-2', msg)])).resolves.toEqual(['ok', 'ok']);
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    const send = calls.find((c) => c.url.includes('fcm.googleapis.com'))!;
    expect(send.url).toBe('https://fcm.googleapis.com/v1/projects/suhbat-test/messages:send');
    expect((send.init.headers as Record<string, string>).Authorization).toBe('Bearer at-1');
    const body = JSON.parse(send.init.body as string) as { message: Record<string, unknown> };
    expect(body.message).toMatchObject({
      token:        'tok-1',
      notification: msg.notification,
      data:         msg.data,
      android:      { priority: 'HIGH', notification: { channel_id: 'messages', tag: 'c' } },
      apns:         { payload: { aps: { 'thread-id': 'c' } } },
    });
  });

  it('401 — tokenni yangilab bir marta qayta urinadi', async () => {
    let tokenCalls = 0;
    let sendCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('oauth2')) return res(200, { access_token: `at-${++tokenCalls}`, expires_in: 3600 });
      return ++sendCalls === 1 ? res(401) : res(200);
    }));
    const client = new FcmClient(config(JSON.stringify(account)));
    expect(await client.send('t', msg)).toBe('ok');
    expect(tokenCalls).toBe(2);
  });

  it('UNREGISTERED — invalid; tarmoq xatosi — error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('oauth2')) return res(200, { access_token: 'at', expires_in: 3600 });
      return res(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
    }));
    const client = new FcmClient(config(JSON.stringify(account)));
    expect(await client.send('t', msg)).toBe('invalid');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    expect(await client.send('t', msg)).toBe('error');
  });
});
