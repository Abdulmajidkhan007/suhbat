// Haqiqiy Postgres + Socket.IO: ikki foydalanuvchi, qidiruv, 1:1 chat,
// real vaqt xabar, "yozmoqda", o'qildi, onlayn, tarix (keyset), refresh.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient, SocketClient } from '@suhbat/client';
import type { ServerToClientEvents } from '@suhbat/core';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { PrismaService } from '../src/prisma/prisma.service';

const stamp = Date.now();
const emails = { ali: `ali-${stamp}@e2e.uz`, vali: `vali-${stamp}@e2e.uz`, gani: `gani-${stamp}@e2e.uz` };

/** Bitta voqeani kutadi (shart bajarilguncha), vaqt o'tsa — xato. */
const next = <E extends keyof ServerToClientEvents>(
  client: SocketClient,
  event: E,
  match: (p: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
  ms = 3000,
) =>
  new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error(`${event} kelmadi`)); }, ms);
    const off = client.on(event, ((p: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!match(p)) return;
      clearTimeout(timer);
      off();
      resolve(p);
    }) as ServerToClientEvents[E]);
  });

const waitConnected = (c: SocketClient) =>
  new Promise<void>((resolve, reject) => {
    if (c.isConnected()) return resolve();
    const timer = setTimeout(() => reject(new Error('ulanmadi')), 3000);
    const off = c.onConnectionChange((up) => { if (up) { clearTimeout(timer); off(); resolve(); } });
  });

describe('Chat (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  const sockets: SocketClient[] = [];
  const mkApi = () => createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
  const mkSocket = (api: ApiClient) => {
    const s = createSocketClient({ url, getAccessToken: api.getAccessToken, refreshAccessToken: api.refreshAccessToken });
    sockets.push(s);
    return s;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { in: Object.values(emails) } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('to\'liq oqim: qidiruv → 1:1 chat → real vaqt → o\'qildi → tarix', async () => {
    const ali = mkApi();
    const vali = mkApi();
    const gani = mkApi();
    const aliUser = await ali.register({ email: emails.ali, password: '12345678', displayName: `Botir ${stamp}` });
    const valiUser = await vali.register({ email: emails.vali, password: '12345678', displayName: `Vali ${stamp}` });
    const ganiUser = await gani.register({ email: emails.gani, password: '12345678', displayName: 'Gani E2E' });

    // Qidiruv: katta-kichik harf farqsiz, o'zini qaytarmaydi
    const found = await ali.searchUsers(`VALI ${stamp}`);
    expect(found.map((u) => u.id)).toEqual([valiUser.id]);
    expect(await ali.searchUsers(`botir ${stamp}`)).toEqual([]); // o'zi chiqmaydi

    // 1:1 chat idempotent: ikkala tomondan ham bitta chat
    const chat = await ali.createDirectChat(valiUser.id);
    const again = await vali.createDirectChat(aliUser.id);
    expect(again.id).toBe(chat.id);
    expect(chat.type).toBe('direct');
    expect(chat.members.map((m) => m.user.id).sort()).toEqual([aliUser.id, valiUser.id].sort());
    expect(await ali.listChats()).toEqual([expect.objectContaining({ id: chat.id, lastMessage: null, unreadCount: 0 })]);

    // Begona foydalanuvchi chatni ko'rmaydi
    await expect(gani.getChat(chat.id)).rejects.toMatchObject({ status: 404 });
    await expect(gani.listMessages(chat.id)).rejects.toMatchObject({ status: 404 });

    // Socket: Ali ulanadi, keyin Vali — Ali "online" xabarini oladi
    const aliWs = mkSocket(ali);
    const aliState = next(aliWs, 'presence:state');
    aliWs.connect();
    await waitConnected(aliWs);
    expect((await aliState).online).toEqual([]);

    const valiWs = mkSocket(vali);
    const valiOnline = next(aliWs, 'presence:update', (p) => p.userId === valiUser.id && p.online);
    const valiState = next(valiWs, 'presence:state');
    valiWs.connect();
    await waitConnected(valiWs);
    await valiOnline;
    expect((await valiState).online).toEqual([aliUser.id]);

    // "Yozmoqda"
    const typing = next(valiWs, 'typing');
    aliWs.setTyping(chat.id, true);
    expect(await typing).toEqual({ chatId: chat.id, userId: aliUser.id, isTyping: true });

    // Xabar: Ali ack oladi (clientId bilan o'ziga), Vali real vaqtda oladi
    const valiGets = next(valiWs, 'message:new');
    const aliEcho = next(aliWs, 'message:new');
    const sent = await aliWs.sendMessage({ chatId: chat.id, content: '  Salom, Vali!  ', clientId: 'tmp-1' });
    expect(sent).toMatchObject({ chatId: chat.id, senderId: aliUser.id, content: 'Salom, Vali!', type: 'text' });
    expect(await valiGets).toEqual({ message: sent });
    expect(await aliEcho).toEqual({ message: sent, clientId: 'tmp-1' });

    // Validatsiya va a'zolik ack orqali qaytadi
    await expect(aliWs.sendMessage({ chatId: chat.id, content: '   ' })).rejects.toThrow('Validation failed');
    const ganiWs = mkSocket(gani);
    ganiWs.connect();
    await waitConnected(ganiWs);
    await expect(ganiWs.sendMessage({ chatId: chat.id, content: 'kirib oldim' })).rejects.toThrow('Chat topilmadi');

    // O'qilmagan: Vali uchun 1, Ali uchun 0
    expect((await vali.getChat(chat.id)).unreadCount).toBe(1);
    expect((await ali.getChat(chat.id)).unreadCount).toBe(0);

    // O'qildi: Vali belgilaydi → Ali `message:read` oladi
    const aliRead = next(aliWs, 'message:read', (p) => p.userId === valiUser.id);
    const { lastReadAt } = await valiWs.markRead(chat.id, sent.id);
    expect(lastReadAt).toBe(sent.createdAt);
    expect(await aliRead).toEqual({ chatId: chat.id, userId: valiUser.id, lastReadAt: sent.createdAt });
    const afterRead = await ali.getChat(chat.id);
    expect(afterRead.members.find((m) => m.user.id === valiUser.id)?.lastReadAt).toBe(sent.createdAt);
    expect((await vali.getChat(chat.id)).unreadCount).toBe(0);

    // Tarix: REST orqali yana 4 ta xabar (REST ham socket'ga tarqatiladi)
    const viaRest = next(valiWs, 'message:new', (p) => p.message.content === 'm1');
    for (let i = 1; i <= 4; i++) await ali.sendMessage(chat.id, { content: `m${i}` });
    await viaRest;

    const p1 = await vali.listMessages(chat.id, { limit: 2 });
    expect(p1.items.map((m) => m.content)).toEqual(['m3', 'm4']);
    const p2 = await vali.listMessages(chat.id, { limit: 2, before: p1.nextCursor! });
    expect(p2.items.map((m) => m.content)).toEqual(['m1', 'm2']);
    const p3 = await vali.listMessages(chat.id, { limit: 2, before: p2.nextCursor! });
    expect(p3).toEqual({ items: [expect.objectContaining({ content: 'Salom, Vali!' })], nextCursor: null });

    const list = await vali.listChats();
    expect(list[0]).toMatchObject({ id: chat.id, unreadCount: 4, lastMessage: expect.objectContaining({ content: 'm4' }) });

    // Ikkalasi ulangan holda yangi chat ochilsa — bir-birining onlayn holatini oladi
    const aliSeesGani = next(aliWs, 'presence:update', (p) => p.userId === ganiUser.id);
    const ganiSeesAli = next(ganiWs, 'presence:update', (p) => p.userId === aliUser.id);
    await ali.createDirectChat(ganiUser.id);
    expect(await aliSeesGani).toEqual({ userId: ganiUser.id, online: true, lastSeenAt: null });
    expect(await ganiSeesAli).toEqual({ userId: aliUser.id, online: true, lastSeenAt: null });

    // Vali uziladi → Ali "offline" + lastSeenAt oladi
    const valiOffline = next(aliWs, 'presence:update', (p) => p.userId === valiUser.id && !p.online);
    valiWs.disconnect();
    const off = await valiOffline;
    expect(off.lastSeenAt).toEqual(expect.any(String));
    const withSeen = await ali.getChat(chat.id);
    expect(withSeen.members.find((m) => m.user.id === valiUser.id)?.lastSeenAt).toBe(off.lastSeenAt);
  });

  it('socket: tokensiz/yaroqsiz token rad etiladi', async () => {
    const onUnauthorized = new Promise<void>((resolve) => {
      const s = createSocketClient({
        url,
        getAccessToken:     async () => 'yaroqsiz',
        refreshAccessToken: async () => null,
        onUnauthorized:     resolve,
      });
      sockets.push(s);
      s.connect();
    });
    await onUnauthorized;
  });

  it('refresh rotatsiyasi, qayta ishlatishni aniqlash, logout', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ email: emails.ali, password: '12345678' })
      .expect(200);
    const r1: string = login.body.refreshToken;

    const rot = await request(server).post('/auth/refresh').send({ refreshToken: r1 }).expect(200);
    const r2: string = rot.body.refreshToken;
    expect(r2).not.toBe(r1);
    await request(server).get('/auth/me').set('Authorization', `Bearer ${rot.body.accessToken}`).expect(200);

    // r1 qayta ishlatildi → 401 va butun oila (r2 ham) bekor
    await request(server).post('/auth/refresh').send({ refreshToken: r1 }).expect(401);
    await request(server).post('/auth/refresh').send({ refreshToken: r2 }).expect(401);

    // Logout: yangi sessiya tokeni bekor bo'ladi
    const again = await request(server).post('/auth/login').send({ email: emails.ali, password: '12345678' }).expect(200);
    await request(server).post('/auth/logout').send({ refreshToken: again.body.refreshToken }).expect(204);
    await request(server).post('/auth/refresh').send({ refreshToken: again.body.refreshToken }).expect(401);
    await request(server).post('/auth/logout').send({ refreshToken: 'nomalum' }).expect(204);
    await request(server).post('/auth/refresh').send({}).expect(400);
  });

  it('REST himoyasi va validatsiya', async () => {
    const server = app.getHttpServer();
    await request(server).get('/chats').expect(401);
    await request(server).get('/users/search?q=a').expect(401);
    const login = await request(server).post('/auth/login').send({ email: emails.gani, password: '12345678' }).expect(200);
    const bearer = `Bearer ${login.body.accessToken}`;
    await request(server).get('/users/search').set('Authorization', bearer).expect(400);
    await request(server).get('/chats/not-a-uuid').set('Authorization', bearer).expect(400);
    await request(server).post('/chats/direct').set('Authorization', bearer).send({ userId: login.body.user.id }).expect(400);
    await request(server)
      .post('/chats/direct')
      .set('Authorization', bearer)
      .send({ userId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
    const chats = await request(server).get('/chats').set('Authorization', bearer).expect(200);
    expect(chats.body).toHaveLength(1); // Ali bilan (birinchi testda ochilgan)
  });
});
