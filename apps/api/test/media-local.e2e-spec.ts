// `local` media drayveri (S3 yo'q): fayl API diskiga (`MEDIA_DIR`) yuklanadi va
// API'ning o'zidan imzolangan havola bilan beriladi. Haqiqiy Postgres + HTTP.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient } from '@suhbat/client';
import type { User } from '@suhbat/core';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const stamp = `ml${Date.now()}`;
const emailOf = (n: string) => `${n}-${stamp}@e2e.uz`;

describe('Media: local drayver (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let dir: string;
  let prisma: PrismaService;
  const api = {} as Record<'ali' | 'vali' | 'begona', ApiClient>;
  const user = {} as Record<'ali' | 'vali' | 'begona', User>;

  beforeAll(async () => {
    // CI'da e2e qadami S3_ENDPOINT beradi — shu faylda local drayver sinaladi.
    delete process.env.S3_ENDPOINT;
    dir = await mkdtemp(join(tmpdir(), 'suhbat-e2e-media-'));
    process.env.MEDIA_DIR = dir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.enableCors({ origin: true });
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    process.env.PUBLIC_API_URL = url;
    prisma = app.get(PrismaService);
    for (const n of ['ali', 'vali', 'begona'] as const) {
      api[n] = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
      user[n] = (await api[n].register({ email: emailOf(n), password: '12345678', displayName: `${n} ${stamp}` })).user;
    }
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@e2e.uz` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    await rm(dir, { recursive: true, force: true });
    delete process.env.MEDIA_DIR;
    delete process.env.PUBLIC_API_URL;
  });

  it('yuklash → xabar → faqat imzolangan havola bilan yuklab olish → o\'chirish', async () => {
    const { ali, vali } = api;
    const chat = await ali.createGroup({ title: `Local ${stamp}`, memberIds: [user.vali.id] });
    const input = { chatId: chat.id, kind: 'image', name: 'rasm.png', mime: 'image/png', size: 2048 } as const;

    // A'zo bo'lmagan foydalanuvchi havola ololmaydi
    await expect(api.begona.createUpload(input)).rejects.toMatchObject({ status: 404 });

    const up = await ali.createUpload(input);
    expect(up.uploadUrl.startsWith(`${url}/media/blob?`)).toBe(true);
    expect(up.headers).toEqual({ 'Content-Type': 'application/octet-stream' });

    // Yuklanmagan fayl biriktirilmaydi
    await expect(ali.sendMessage(chat.id, { content: '', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });

    // Imzo buzilgan / hajm boshqa — rad
    const forged = new URL(up.uploadUrl);
    forged.searchParams.set('size', '4096');
    expect((await fetch(forged, { method: 'PUT', headers: up.headers, body: new Uint8Array(4096) })).status).toBe(403);
    expect((await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: new Uint8Array(5000) })).status).toBe(413);
    expect((await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: new Uint8Array(100) })).status).toBe(400);

    // Brauzer preflight (CORS) o'tadi
    const pre = await fetch(up.uploadUrl, {
      method:  'OPTIONS',
      headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(pre.status).toBeLessThan(300);

    const bytes = new Uint8Array(2048).fill(7);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG imzosi: tur ichidan tekshiriladi
    const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: bytes });
    expect(put.status).toBe(200);
    // Qayta yozib bo'lmaydi
    expect((await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: bytes })).status).toBe(409);

    // Boshqa foydalanuvchi bu biriktirmani ishlata olmaydi
    await expect(vali.sendMessage(chat.id, { content: '', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });
    const msg = await ali.sendMessage(chat.id, { content: 'Mana', attachmentId: up.attachmentId });
    expect(msg).toMatchObject({ type: 'image', attachment: { id: up.attachmentId, mime: 'image/png', size: 2048 } });

    // Qabul qiluvchi tarixdan havola oladi va yuklab oladi
    const att = (await vali.listMessages(chat.id)).items[0].attachment!;
    expect(att.url.startsWith(`${url}/media/blob?`)).toBe(true);
    const dl = await fetch(att.url);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-type')).toBe('image/png');
    expect(dl.headers.get('content-disposition')).toBe('inline; filename*=UTF-8\'\'rasm.png');
    expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
    expect(dl.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await dl.arrayBuffer())).toEqual(Buffer.from(bytes));

    // Range (Safari'da audio/video uchun kerak)
    const part = await fetch(att.url, { headers: { Range: 'bytes=0-9' } });
    expect(part.status).toBe(206);
    expect((await part.arrayBuffer()).byteLength).toBe(10);

    // Havolasiz / buzilgan havola — yo'q
    const tampered = new URL(att.url);
    tampered.searchParams.set('mime', 'text/html');
    expect((await fetch(tampered)).status).toBe(403);
    expect((await fetch(`${url}/media/blob?key=${encodeURIComponent((await prisma.attachment.findUniqueOrThrow({ where: { id: up.attachmentId } })).key)}`)).status).toBe(403);

    // Xabar o'chirilganda fayl ham diskdan o'chadi
    const key = (await prisma.attachment.findUniqueOrThrow({ where: { id: up.attachmentId } })).key;
    expect(existsSync(join(dir, key))).toBe(true);
    await ali.deleteMessage(chat.id, msg.id);
    expect(existsSync(join(dir, key))).toBe(false);
    expect((await fetch(att.url)).status).toBe(404);
  });

  it('magic bytes: rasm deb yuklangan HTML/SVG/nomi mos kelmagan fayl xabarga biriktirilmaydi va o\'chiriladi', async () => {
    const { ali } = api;
    const chat = await ali.createGroup({ title: `Sniff ${stamp}`, memberIds: [user.vali.id] });
    const fake = async (name: string, mime: string, kind: 'image' | 'file', body: string) => {
      const up = await ali.uploadAttachment({ chatId: chat.id, kind, name, mime, size: body.length }, new Blob([body]));
      const row = await prisma.attachment.findUniqueOrThrow({ where: { id: up.attachmentId } });
      await expect(ali.sendMessage(chat.id, { content: '', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });
      expect(existsSync(join(dir, row.key))).toBe(false);
    };
    await fake('rasm.png', 'image/png', 'image', '<!doctype html><script>alert(1)</script>');
    await fake('rasm.png', 'image/png', 'image', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    await fake('rasm.jpg', 'application/pdf', 'file', '%PDF-1.7 hujjat'); // nomi mazmuniga mos emas
  });

  it('JSON fayl (body-parser ushlamaydi), ovoz va faylning "attachment" havolasi', async () => {
    const { ali } = api;
    const chat = await ali.createGroup({ title: `Local2 ${stamp}`, memberIds: [user.vali.id] });
    const json = '{"a":1}';
    const file = await ali.uploadAttachment(
      { chatId: chat.id, kind: 'file', name: 'ma\'lumot.json', mime: 'application/json', size: json.length },
      new Blob([json], { type: 'application/json' }),
    );
    const fileMsg = await ali.sendMessage(chat.id, { content: '', attachmentId: file.attachmentId });
    const res = await fetch(fileMsg.attachment!.url);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('ma\'lumot.json')}`);
    expect(await res.text()).toBe(json);

    const voice = await ali.uploadAttachment(
      { chatId: chat.id, kind: 'voice', name: 'ovoz.webm', mime: 'audio/webm', size: 4, durationMs: 1200 },
      new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' }),
    );
    const voiceMsg = await ali.sendMessage(chat.id, { content: '', attachmentId: voice.attachmentId });
    expect(voiceMsg).toMatchObject({ type: 'voice', attachment: { durationMs: 1200 } });
    expect(Buffer.from(await (await fetch(voiceMsg.attachment!.url)).arrayBuffer())).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  });
});
