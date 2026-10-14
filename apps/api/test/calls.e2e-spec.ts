// Qo'ng'iroq signali: haqiqiy Postgres + Socket.IO, ikki (va undan ko'p) socket mijoz.
// Media (WebRTC) bu yerda sinalmaydi — faqat signal, holat, tizim xabari, push, ICE serverlar.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient, SocketClient } from '@suhbat/client';
import type { User } from '@suhbat/core';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { CallsGateway } from '../src/calls/calls.gateway';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { PrismaService } from '../src/prisma/prisma.service';
import { FcmClient } from '../src/push/fcm.client';
import type { FcmMessage, FcmResult } from '../src/push/fcm.client';
import { never, next, waitConnected } from './helpers';

const stamp = `c${Date.now()}`;
const emailOf = (n: string) => `${n}-${stamp}@e2e.uz`;
const names = ['ali', 'vali', 'gani', 'sobir'] as const;
type Name = (typeof names)[number];
const RING_MS = 600;

class FakeFcm {
  readonly enabled = true;
  readonly sent: { token: string; message: FcmMessage }[] = [];
  async send(token: string, message: FcmMessage): Promise<FcmResult> {
    this.sent.push({ token, message });
    return 'ok';
  }
}

describe('Qo\'ng\'iroqlar (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let gateway: CallsGateway;
  const fcm = new FakeFcm();
  const api = {} as Record<Name, ApiClient>;
  const user = {} as Record<Name, User>;
  const open: SocketClient[] = [];
  let direct: string; // ali ↔ vali
  let aliGani: string;
  let aliSobir: string;

  const connect = async (n: Name) => {
    const s = createSocketClient({ url, getAccessToken: api[n].getAccessToken, refreshAccessToken: api[n].refreshAccessToken });
    open.push(s);
    s.connect();
    await waitConnected(s);
    return s;
  };

  /** Tizim xabari chatda paydo bo'lishini kutadi. */
  const systemMessage = async (chatId: string, content: string) =>
    vi.waitUntil(
      async () => (await api.ali.listMessages(chatId)).items.find((m) => m.type === 'system' && m.content === content),
      { timeout: 3000 },
    );

  beforeAll(async () => {
    process.env.CALL_RING_TIMEOUT_MS = String(RING_MS);
    process.env.CALL_INVITE_LIMIT = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FcmClient)
      .useValue(fcm)
      .compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    gateway = app.get(CallsGateway);

    for (const n of names) {
      api[n] = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
      user[n] = await api[n].register({ email: emailOf(n), password: '12345678', displayName: `${n} ${stamp}` });
    }
    direct = (await api.ali.createDirectChat(user.vali.id)).id;
    aliGani = (await api.ali.createDirectChat(user.gani.id)).id;
    aliSobir = (await api.ali.createDirectChat(user.sobir.id)).id;
  });

  beforeEach(async () => {
    open.splice(0).forEach((s) => s.disconnect());
    await vi.waitUntil(() => gateway.activeCalls === 0, { timeout: 3000 });
    fcm.sent.length = 0;
  });

  afterAll(async () => {
    open.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@e2e.uz` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('invite → ringing → accept → offer/answer/ice → end; tizim xabari davomiylik bilan', async () => {
    const ali = await connect('ali');
    const vali = await connect('vali');
    const vali2 = await connect('vali'); // vali'ning ikkinchi qurilmasi
    const callId = randomUUID();

    const incoming = next(vali, 'call:invite');
    const incoming2 = next(vali2, 'call:invite');
    expect(await ali.inviteCall({ callId, chatId: direct, media: 'video' })).toEqual({ callId });
    const invite = await incoming;
    expect(invite).toMatchObject({ callId, chatId: direct, media: 'video', from: { id: user.ali.id } });
    expect(JSON.stringify(invite)).not.toContain('@'); // email sizmaydi
    await incoming2;

    const ringing = next(ali, 'call:ringing');
    vali.callRinging(callId);
    expect(await ringing).toEqual({ callId });

    const accepted = next(ali, 'call:accept');
    const elsewhere = next(vali2, 'call:end');
    expect(await vali.acceptCall(callId)).toEqual({ callId });
    await accepted;
    expect(await elsewhere).toEqual({ callId, reason: 'answered_elsewhere', durationMs: null });

    // Signal faqat bog'langan ikki socket orasida
    const offer = next(vali, 'call:offer');
    const strayOffer = never(vali2, 'call:offer');
    ali.sendCallOffer(callId, { type: 'offer', sdp: 'v=0 offer' });
    expect(await offer).toEqual({ callId, description: { type: 'offer', sdp: 'v=0 offer' } });
    await strayOffer;

    const answer = next(ali, 'call:answer');
    vali.sendCallAnswer(callId, { type: 'answer', sdp: 'v=0 answer' });
    expect((await answer).description.sdp).toBe('v=0 answer');

    const candidate = { candidate: 'candidate:1 1 udp 2122260223 10.0.0.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    const iceAtVali = next(vali, 'call:ice');
    ali.sendCallIce(callId, candidate);
    expect(await iceAtVali).toEqual({ callId, candidate });
    const iceAtAli = next(ali, 'call:ice');
    vali.sendCallIce(callId, null);
    expect(await iceAtAli).toEqual({ callId, candidate: null });

    // Ikkinchi qurilma signal yubora olmaydi (qo'ng'iroqqa bog'lanmagan)
    const strayIce = never(ali, 'call:ice');
    vali2.sendCallIce(callId, candidate);
    await strayIce;

    const endedAtAli = next(ali, 'call:end');
    await new Promise((r) => setTimeout(r, 50));
    expect(await vali.endCall(callId)).toEqual({ callId });
    const ended = await endedAtAli;
    expect(ended).toMatchObject({ callId, reason: 'hangup' });
    expect(ended.durationMs).toBeGreaterThanOrEqual(50);

    const msg = await systemMessage(direct, '🎥 Video qo\'ng\'iroq, 0:00');
    expect(msg.senderId).toBe(user.ali.id);
    expect(gateway.activeCalls).toBe(0);
  });

  it('rad etish va bekor qilish — tizim xabari, ikkala tomonga call:end', async () => {
    const ali = await connect('ali');
    const vali = await connect('vali');

    const c1 = randomUUID();
    const invite = next(vali, 'call:invite');
    await ali.inviteCall({ callId: c1, chatId: direct, media: 'audio' });
    await invite;
    const endedAtAli = next(ali, 'call:end');
    await vali.rejectCall(c1);
    expect(await endedAtAli).toEqual({ callId: c1, reason: 'rejected', durationMs: null });
    await systemMessage(direct, '📞 Rad etilgan qo\'ng\'iroq');

    const c2 = randomUUID();
    const invite2 = next(vali, 'call:invite');
    await ali.inviteCall({ callId: c2, chatId: direct, media: 'audio' });
    await invite2;
    const endedAtVali = next(vali, 'call:end');
    await ali.cancelCall(c2);
    expect(await endedAtVali).toEqual({ callId: c2, reason: 'cancelled', durationMs: null });
    await systemMessage(direct, '📞 Bekor qilingan qo\'ng\'iroq');

    // Begona qo'ng'iroqni bekor qilib/rad etib bo'lmaydi
    await expect(vali.cancelCall(randomUUID())).rejects.toThrow('Qo\'ng\'iroq topilmadi');
  });

  it('band: qabul qiluvchi boshqa qo\'ng\'iroqda — call:busy; o\'zi qo\'ng\'iroqda — xato', async () => {
    const ali = await connect('ali');
    const vali = await connect('vali');
    const gani = await connect('gani');

    const first = randomUUID();
    const invite = next(vali, 'call:invite');
    await ali.inviteCall({ callId: first, chatId: direct, media: 'audio' });
    await invite;

    // gani ali'ga qo'ng'iroq qiladi — ali band
    const busyCall = randomUUID();
    const busy = next(gani, 'call:busy');
    const noInvite = never(ali, 'call:invite');
    expect(await gani.inviteCall({ callId: busyCall, chatId: aliGani, media: 'audio' })).toEqual({ callId: busyCall });
    expect(await busy).toEqual({ callId: busyCall });
    await noInvite;
    await systemMessage(aliGani, '📞 Javobsiz qo\'ng\'iroq');

    // ali o'zi qo'ng'iroqda — ikkinchisini boshlay olmaydi
    await expect(ali.inviteCall({ callId: randomUUID(), chatId: aliGani, media: 'audio' })).rejects.toThrow(
      'Siz allaqachon qo\'ng\'iroqdasiz',
    );
    // Bir xil callId qayta ishlatilmaydi
    await expect(gani.inviteCall({ callId: first, chatId: aliGani, media: 'audio' })).rejects.toThrow();
    await ali.cancelCall(first);
  });

  it('javob bo\'lmasa — timeout: missed, "Javobsiz qo\'ng\'iroq"; oflayn bo\'lsa push', async () => {
    await api.sobir.registerDevice({ platform: 'android', token: `tok-sobir-${stamp}` });
    const ali = await connect('ali');
    const callId = randomUUID();
    const ended = next(ali, 'call:end', () => true, RING_MS + 2000);
    await ali.inviteCall({ callId, chatId: aliSobir, media: 'video' });

    // sobir oflayn — push (qo'ng'iroq kanali, TTL = jiringlash vaqti)
    await vi.waitUntil(() => fcm.sent.length > 0);
    expect(fcm.sent).toEqual([
      {
        token:   `tok-sobir-${stamp}`,
        message: {
          notification: { title: `ali ${stamp}`, body: '🎥 Kiruvchi video qo\'ng\'iroq' },
          data:         { type: 'call', callId, chatId: aliSobir, media: 'video' },
          threadId:     callId,
          channelId:    'calls',
          ttlSeconds:   1,
        },
      },
    ]);

    // Push bosildi — ilova ulandi: jiringlayotgan qo'ng'iroq qayta keladi
    const sobir = createSocketClient({ url, getAccessToken: api.sobir.getAccessToken, refreshAccessToken: api.sobir.refreshAccessToken });
    open.push(sobir);
    const redelivered = next(sobir, 'call:invite');
    sobir.connect();
    expect(await redelivered).toMatchObject({ callId, media: 'video', from: { id: user.ali.id } });

    expect(await ended).toEqual({ callId, reason: 'missed', durationMs: null });
    await systemMessage(aliSobir, '🎥 Javobsiz video qo\'ng\'iroq');
  });

  it('chaqiruvchi uzilsa — cancelled; gaplashayotganda uzilsa — disconnected', async () => {
    const ali = await connect('ali');
    const vali = await connect('vali');

    const c1 = randomUUID();
    const invite = next(vali, 'call:invite');
    await ali.inviteCall({ callId: c1, chatId: direct, media: 'audio' });
    await invite;
    const ended1 = next(vali, 'call:end');
    ali.disconnect();
    expect(await ended1).toMatchObject({ callId: c1, reason: 'cancelled' });

    const ali2 = await connect('ali');
    const c2 = randomUUID();
    const invite2 = next(vali, 'call:invite');
    await ali2.inviteCall({ callId: c2, chatId: direct, media: 'audio' });
    await invite2;
    await vali.acceptCall(c2);
    const ended2 = next(ali2, 'call:end');
    vali.disconnect();
    const e = await ended2;
    expect(e).toMatchObject({ callId: c2, reason: 'disconnected' });
    expect(e.durationMs).not.toBeNull();
    expect(gateway.activeCalls).toBe(0);
  });

  it('ruxsatsiz: guruhga, a\'zo bo\'lmagan chatga, bloklangan foydalanuvchiga qo\'ng\'iroq yo\'q', async () => {
    const group = await api.ali.createGroup({ title: `G ${stamp}`, memberIds: [user.vali.id] });
    const ali = await connect('ali');
    const gani = await connect('gani');
    await expect(ali.inviteCall({ callId: randomUUID(), chatId: group.id, media: 'audio' })).rejects.toThrow('1:1');
    // gani ali↔vali chatining a'zosi emas
    await expect(gani.inviteCall({ callId: randomUUID(), chatId: direct, media: 'audio' })).rejects.toThrow('Chat topilmadi');
    await expect(ali.inviteCall({ callId: 'yaroqsiz', chatId: direct, media: 'audio' } as never)).rejects.toThrow('Validation');

    await api.gani.blockUser(user.ali.id);
    await expect(ali.inviteCall({ callId: randomUUID(), chatId: aliGani, media: 'audio' })).rejects.toThrow('bloklangan');
    await api.gani.unblockUser(user.ali.id);

    // Begona foydalanuvchi boshqalar qo'ng'irog'ini qabul qila/tugata olmaydi
    const vali = await connect('vali');
    const callId = randomUUID();
    const invite = next(vali, 'call:invite');
    await ali.inviteCall({ callId, chatId: direct, media: 'audio' });
    await invite;
    await expect(gani.acceptCall(callId)).rejects.toThrow('Qo\'ng\'iroq topilmadi');
    await expect(gani.endCall(callId)).rejects.toThrow('Qo\'ng\'iroq topilmadi');
    const noOffer = never(vali, 'call:offer');
    ali.sendCallOffer(callId, { type: 'offer', sdp: 'v=0' }); // hali qabul qilinmagan — uzatilmaydi
    await noOffer;
    await ali.cancelCall(callId);
  });

  it('token muddati tugasa ham faol qo\'ng\'iroq socket\'i uzilmaydi; tugagach uziladi', async () => {
    const jwt = app.get(JwtService);
    const token = await jwt.signAsync({ sub: user.ali.id }, { expiresIn: '1s' });
    const ali = createSocketClient({ url, getAccessToken: async () => token, refreshAccessToken: api.ali.refreshAccessToken });
    open.push(ali);
    const drops: string[] = [];
    ali.onConnectionChange((up) => { if (!up) drops.push('down'); });
    ali.connect();
    await waitConnected(ali);
    const vali = await connect('vali');

    const callId = randomUUID();
    const invite = next(vali, 'call:invite');
    await ali.inviteCall({ callId, chatId: direct, media: 'audio' });
    await invite;
    await vali.acceptCall(callId);

    await new Promise((r) => setTimeout(r, 2200)); // token tugadi
    expect(drops).toEqual([]);
    expect(gateway.activeCalls).toBe(1);

    await vali.endCall(callId);
    // Qo'ng'iroq tugadi — keyingi tekshiruvda (≤ 5 s) uziladi
    await vi.waitUntil(() => drops.length > 0, { timeout: 7_000, interval: 200 });
  }, 15_000);

  it('GET /calls/ice-servers: auth kerak, standart — Google STUN', async () => {
    expect((await fetch(`${url}/calls/ice-servers`)).status).toBe(401);
    const res = await api.ali.getIceServers();
    expect(res.iceServers[0]).toEqual({ urls: ['stun:stun.l.google.com:19302'] });
  });
});
