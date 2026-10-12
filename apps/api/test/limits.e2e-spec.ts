// WS message:send cheklovi va tugatilmagan yuklashlarni tozalash.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { SocketClient } from '@suhbat/client';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { MediaCleanupService } from '../src/media/media-cleanup.service';
import { MediaService } from '../src/media/media.service';
import { StorageService } from '../src/media/storage.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ensureStorage, waitConnected } from './helpers';

const stamp = Date.now();
const emailOf = (n: string) => `${n}-${stamp}@e2e.uz`;
const DAY_MS = 24 * 3_600_000;

describe('WS cheklovi va yuklashlarni tozalash (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let storage: Awaited<ReturnType<typeof ensureStorage>>;
  let savedLimit: string | undefined;
  const sockets: SocketClient[] = [];

  beforeAll(async () => {
    savedLimit = process.env.WS_SEND_LIMIT;
    process.env.WS_SEND_LIMIT = '2';
    storage = await ensureStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@e2e.uz` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    await storage.close();
    if (savedLimit === undefined) delete process.env.WS_SEND_LIMIT;
    else process.env.WS_SEND_LIMIT = savedLimit;
  });

  it('message:send: limitdan keyin ack xato, REST zaxira ta\'sirlanmaydi', async () => {
    const api = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
    const ali = await api.register({ email: emailOf('ali'), password: '12345678', displayName: `Ali ${stamp}` });
    const vali = await createApiClient({ baseUrl: url, storage: memoryTokenStorage() }).register({
      email: emailOf('vali'), password: '12345678', displayName: `Vali ${stamp}`,
    });
    const chat = await api.createDirectChat(vali.id);
    const ws = createSocketClient({ url, getAccessToken: api.getAccessToken, refreshAccessToken: api.refreshAccessToken });
    sockets.push(ws);
    ws.connect();
    await waitConnected(ws);

    await ws.sendMessage({ chatId: chat.id, content: '1' });
    await ws.sendMessage({ chatId: chat.id, content: '2' });
    await expect(ws.sendMessage({ chatId: chat.id, content: '3' })).rejects.toThrow(/tez-tez/);
    expect(ali.id).not.toBe(vali.id);
  });

  it('tozalash: eski yetim yuklash o\'chadi; yangi va xabarga biriktirilgani qoladi', async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { email: emailOf('ali') } });
    const chat = await prisma.chat.findFirstOrThrow({ where: { members: { some: { userId: owner.id } } } });
    const media = app.get(MediaService);
    const store = app.get(StorageService);
    const input = { chatId: chat.id, kind: 'image', name: 'r.png', mime: 'image/png', size: 16 } as const;

    const upload = async () => {
      const up = await media.createUpload(owner.id, input);
      const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: new Uint8Array(16) });
      expect(put.ok).toBe(true);
      return up.attachmentId;
    };
    const [stale, fresh, claimed] = [await upload(), await upload(), await upload()];
    const old = new Date(Date.now() - DAY_MS - 60_000);
    const message = await prisma.message.create({
      data: { chatId: chat.id, senderId: owner.id, type: 'image', content: '' },
    });
    await prisma.attachment.update({ where: { id: claimed }, data: { messageId: message.id, createdAt: old } });
    await prisma.attachment.update({ where: { id: stale }, data: { createdAt: old } });
    const key = (id: string) => `chats/${chat.id}/${id}`;
    expect(await store.head(key(stale))).not.toBeNull();

    // Boshqa testlar qoldirgan eski yetimlar ham o'chadi — shuning uchun >= 1.
    expect(await app.get(MediaCleanupService).run()).toBeGreaterThanOrEqual(1);

    expect(await prisma.attachment.findUnique({ where: { id: stale } })).toBeNull();
    expect(await store.head(key(stale))).toBeNull();
    expect(await prisma.attachment.findUnique({ where: { id: fresh } })).not.toBeNull();
    expect(await store.head(key(fresh))).not.toBeNull();
    expect(await prisma.attachment.findUnique({ where: { id: claimed } })).not.toBeNull();
    expect(await store.head(key(claimed))).not.toBeNull();
  });
});
