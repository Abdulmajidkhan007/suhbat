// Push bildirishnomalar: haqiqiy Postgres + Socket.IO, FCM — soxta (`FcmClient` almashtiriladi).
// Qurilma tokenlari, onlayn/oflayn, preview sozlamasi, bloklash, yaroqsiz token, logout.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient, SocketClient } from '@suhbat/client';
import type { User } from '@suhbat/core';
import type { AddressInfo } from 'node:net';
import type { MockInstance } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { PrismaService } from '../src/prisma/prisma.service';
import { FcmClient } from '../src/push/fcm.client';
import type { FcmMessage, FcmResult } from '../src/push/fcm.client';
import { PushService } from '../src/push/push.service';
import { waitConnected } from './helpers';

const stamp = `p${Date.now()}`;
const emailOf = (n: string) => `${n}-${stamp}@e2e.uz`;
const names = ['ali', 'vali', 'gani'] as const;
type Name = (typeof names)[number];

/** Soxta FCM: yuborilganlarni yozib boradi; token bo'yicha javobni almashtirish mumkin. */
class FakeFcm {
  readonly enabled = true;
  readonly sent: { token: string; message: FcmMessage }[] = [];
  results: Record<string, FcmResult> = {};
  /** Berilsa — `send` shu va'da bajarilguncha kutadi (javob bloklanmasligini tekshirish uchun). */
  gate: Promise<void> | null = null;

  async send(token: string, message: FcmMessage): Promise<FcmResult> {
    if (this.gate) await this.gate;
    this.sent.push({ token, message });
    return this.results[token] ?? 'ok';
  }
}

describe('Push bildirishnomalar (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let notify: MockInstance<PushService['notifyNewMessage']>;
  const fcm = new FakeFcm();
  const api = {} as Record<Name, ApiClient>;
  const user = {} as Record<Name, User>;
  const sockets: SocketClient[] = [];

  /** Shu paytgacha boshlangan barcha push yuborishlarini kutadi. */
  const settle = async () => {
    await Promise.all(notify.mock.results.map((r) => r.value));
  };
  const tokensOf = (to: string) => fcm.sent.filter((s) => s.token === to);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FcmClient)
      .useValue(fcm)
      .compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    notify = vi.spyOn(app.get(PushService), 'notifyNewMessage');

    for (const n of names) {
      api[n] = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
      user[n] = await api[n].register({ email: emailOf(n), password: '12345678', displayName: `${n} ${stamp}` });
    }
  });

  beforeEach(async () => {
    await settle();
    fcm.sent.length = 0;
    fcm.results = {};
    fcm.gate = null;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@e2e.uz` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('POST/DELETE /devices: upsert, boshqa hisobga o\'tish, faqat o\'z tokenini o\'chirish', async () => {
    const token = `tok-move-${stamp}`;
    await api.ali.registerDevice({ platform: 'android', token });
    await api.ali.registerDevice({ platform: 'android', token }); // idempotent
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);

    // Shu qurilmada boshqa hisob bilan kirildi — token vali'ga o'tadi
    await api.vali.registerDevice({ platform: 'ios', token });
    expect(await prisma.deviceToken.findUnique({ where: { token } })).toMatchObject({ userId: user.vali.id, platform: 'ios' });

    await api.ali.unregisterDevice(token); // begona token — o'chmaydi (204)
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
    await api.vali.unregisterDevice(token);
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);

    const res = await fetch(`${url}/devices`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${(await api.ali.getAccessToken())!}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ platform: 'symbian', token: 'x' }),
    });
    expect(res.status).toBe(400);
    expect((await fetch(`${url}/devices`, { method: 'POST' })).status).toBe(401);
  });

  it('oflayn a\'zoga push (matn bilan), o\'ziga yo\'q; onlayn bo\'lsa — yo\'q', async () => {
    const valiToken = `tok-vali-${stamp}`;
    const aliToken = `tok-ali-${stamp}`;
    await api.vali.registerDevice({ platform: 'android', token: valiToken });
    await api.ali.registerDevice({ platform: 'ios', token: aliToken });
    const chat = await api.ali.createDirectChat(user.vali.id);

    const sent = await api.ali.sendMessage(chat.id, { content: 'salom vali' });
    await settle();
    expect(tokensOf(aliToken)).toHaveLength(0);
    expect(tokensOf(valiToken)).toEqual([
      {
        token:   valiToken,
        message: {
          notification: { title: `ali ${stamp}`, body: 'salom vali' },
          data:         { type: 'message', chatId: chat.id, messageId: sent.id },
          threadId:     chat.id,
        },
      },
    ]);

    // vali onlayn (socket ulangan) — push ketmaydi
    const socket = createSocketClient({
      url,
      getAccessToken:     api.vali.getAccessToken,
      refreshAccessToken: api.vali.refreshAccessToken,
    });
    sockets.push(socket);
    socket.connect();
    await waitConnected(socket);
    fcm.sent.length = 0;
    await api.ali.sendMessage(chat.id, { content: 'onlaynsan' });
    await settle();
    expect(tokensOf(valiToken)).toHaveLength(0);

    socket.disconnect();
    await vi.waitUntil(async () => (await prisma.user.findUnique({ where: { id: user.vali.id } }))?.lastSeenAt != null);
    await api.ali.sendMessage(chat.id, { content: 'yana oflayn' });
    await settle();
    expect(tokensOf(valiToken)).toHaveLength(1);
  });

  it('push sekin bo\'lsa ham xabar yuborish javobi kutmaydi', async () => {
    const chat = await api.ali.createDirectChat(user.vali.id);
    let release!: () => void;
    fcm.gate = new Promise<void>((r) => { release = r; });
    const started = Date.now();
    await api.ali.sendMessage(chat.id, { content: 'tez javob' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(fcm.sent).toHaveLength(0); // FCM hali "javob bermadi"
    release();
    await settle();
    expect(fcm.sent.length).toBeGreaterThan(0);
  });

  it('preview o\'chirilsa — "Yangi xabar", sozlama GET/PATCH', async () => {
    expect(await api.vali.getNotificationSettings()).toEqual({ preview: true });
    expect(await api.vali.updateNotificationSettings({ preview: false })).toEqual({ preview: false });
    const chat = await api.ali.createDirectChat(user.vali.id);
    await api.ali.sendMessage(chat.id, { content: 'maxfiy matn' });
    await settle();
    const pushes = tokensOf(`tok-vali-${stamp}`);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.message.notification).toEqual({ title: 'Suhbat', body: 'Yangi xabar' });
    expect(JSON.stringify(pushes[0])).not.toContain('maxfiy');
    await api.vali.updateNotificationSettings({ preview: true });
  });

  it('guruhda: sarlavha — guruh nomi; bloklagan/bloklanganga push yo\'q; 1:1 da yozib bo\'lmaydi', async () => {
    const ganiToken = `tok-gani-${stamp}`;
    await api.gani.registerDevice({ platform: 'web', token: ganiToken });
    const group = await api.ali.createGroup({ title: `Guruh ${stamp}`, memberIds: [user.vali.id, user.gani.id] });

    await api.ali.sendMessage(group.id, { content: 'hammaga' });
    await settle();
    expect(tokensOf(ganiToken)[0]?.message.notification).toEqual({ title: `Guruh ${stamp}`, body: `ali ${stamp}: hammaga` });
    expect(tokensOf(`tok-vali-${stamp}`)).toHaveLength(1);

    // vali ali'ni blokladi: ali'dan vali'ga push yo'q, vali'dan ali'ga ham yo'q
    await api.vali.blockUser(user.ali.id);
    await api.vali.blockUser(user.ali.id); // idempotent
    expect((await api.vali.listBlocked()).map((u) => u.id)).toEqual([user.ali.id]);
    fcm.sent.length = 0;
    await api.ali.sendMessage(group.id, { content: 'blokdan keyin' });
    await settle();
    expect(tokensOf(`tok-vali-${stamp}`)).toHaveLength(0);
    expect(tokensOf(ganiToken)).toHaveLength(1);
    fcm.sent.length = 0;
    await api.vali.sendMessage(group.id, { content: 'validan' });
    await settle();
    expect(tokensOf(`tok-ali-${stamp}`)).toHaveLength(0);
    expect(tokensOf(ganiToken)).toHaveLength(1);

    // 1:1 da ikki tomon ham yozolmaydi
    const direct = await api.ali.createDirectChat(user.vali.id);
    await expect(api.ali.sendMessage(direct.id, { content: 'x' })).rejects.toMatchObject({ status: 403 });
    await expect(api.vali.sendMessage(direct.id, { content: 'x' })).rejects.toMatchObject({ status: 403 });
    await expect(api.vali.blockUser(user.vali.id)).rejects.toMatchObject({ status: 400 });

    await api.vali.unblockUser(user.ali.id);
    expect(await api.vali.listBlocked()).toEqual([]);
    await api.ali.sendMessage(direct.id, { content: 'blokdan chiqdi' });
  });

  it('yaroqsiz token (UNREGISTERED) o\'chiriladi', async () => {
    const dead = `tok-dead-${stamp}`;
    await api.gani.registerDevice({ platform: 'android', token: dead });
    fcm.results[dead] = 'invalid';
    const chat = await api.ali.createDirectChat(user.gani.id);
    await api.ali.sendMessage(chat.id, { content: 'kimsan' });
    await settle();
    expect(tokensOf(dead)).toHaveLength(1);
    expect(await prisma.deviceToken.count({ where: { token: dead } })).toBe(0);
    expect(await prisma.deviceToken.count({ where: { token: `tok-gani-${stamp}` } })).toBe(1);
  });

  it('logout deviceToken bilan — shu qurilma tokeni o\'chadi', async () => {
    const token = `tok-logout-${stamp}`;
    const fresh = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
    await fresh.login({ login: emailOf('gani'), password: '12345678' });
    await fresh.registerDevice({ platform: 'android', token });
    // Begona token logout'da o'chmaydi
    await api.vali.registerDevice({ platform: 'android', token: `tok-other-${stamp}` });
    const other = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
    await other.login({ login: emailOf('gani'), password: '12345678' });
    await other.logout({ deviceToken: `tok-other-${stamp}` });
    expect(await prisma.deviceToken.count({ where: { token: `tok-other-${stamp}` } })).toBe(1);

    await fresh.logout({ deviceToken: token });
    expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);
  });
});
