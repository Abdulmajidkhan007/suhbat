// Faoliyat jurnali (haqiqiy Postgres + local media): hodisalar yoziladi, MATN va maxfiy media mazmuni
// admin API'da qaytmaydi, retention tozalash, admin bo'lmaganga 404.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient } from '@suhbat/client';
import type { AdminActivityList, AdminMediaList, AdminOverview, AdminReportList, User } from '@suhbat/core';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActivityService } from '../src/activity/activity.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const stamp = `act${Date.now().toString(36)}`;
const domain = `-${stamp}@activity.e2e.uz`;
const emailOf = (n: string) => `${n}${domain}`;
const PASSWORD = '12345678';
const SECRET_TEXT = `TOP-SECRET-${stamp}-matn`;
const UA = `SuhbatTest/1.0 (${stamp})`;

describe('Faoliyat jurnali (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let activity: ActivityService;
  let url: string;
  let dir: string;
  const savedAdmin = process.env.ADMIN_EMAILS;
  const api = {} as Record<'boss' | 'ali' | 'vali', ApiClient>;
  const user = {} as Record<'boss' | 'ali' | 'vali', User>;
  const token = {} as Record<'boss' | 'ali' | 'vali', string>;
  const server = () => app.getHttpServer();
  const get = (t: string, path: string) => request(server()).get(path).set({ Authorization: `Bearer ${t}`, 'User-Agent': UA });
  const rows = (userId: string) => prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  /** Fonda yozilgan jurnalni kutadi. */
  const settle = () => new Promise((r) => setTimeout(r, 150));

  const png = (size: number) => {
    const b = new Uint8Array(size).fill(7);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return b;
  };
  /** Haqiqiy oqim: upload-url → PUT → xabar (media_upload shu yerda yoziladi). */
  const sendImage = async (who: 'ali' | 'vali', chatId: string, name: string) => {
    const up = await api[who].createUpload({ chatId, kind: 'image', name, mime: 'image/png', size: 2048 });
    expect((await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: png(2048) })).status).toBe(200);
    return api[who].sendMessage(chatId, { content: '', attachmentId: up.attachmentId });
  };

  beforeAll(async () => {
    delete process.env.S3_ENDPOINT;
    dir = await mkdtemp(join(tmpdir(), 'suhbat-e2e-activity-'));
    process.env.MEDIA_DIR = dir;
    process.env.ADMIN_EMAILS = emailOf('boss');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    process.env.PUBLIC_API_URL = url;
    prisma = app.get(PrismaService);
    activity = app.get(ActivityService);
    for (const n of ['boss', 'ali', 'vali'] as const) {
      api[n] = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
      user[n] = (await api[n].register({ email: emailOf(n), password: PASSWORD, displayName: `${n} ${stamp}` })).user;
      token[n] = (await api[n].getAccessToken())!;
    }
  });

  afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { email: { endsWith: domain } }, select: { id: true } })).map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.activityLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { device: { contains: stamp } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { adminEmail: emailOf('boss') } });
    await app.close();
    await rm(dir, { recursive: true, force: true });
    if (savedAdmin === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = savedAdmin;
    delete process.env.MEDIA_DIR;
    delete process.env.PUBLIC_API_URL;
  });

  it('hisob hodisalari: register, login, login_failed (parol/login yozilmaydi), logout, password_change; IP va qurilma bilan', async () => {
    const res = await request(server()).post('/auth/register').set('User-Agent', UA)
      .send({ email: emailOf('acc'), password: PASSWORD, displayName: `acc ${stamp}` });
    const id = res.body.user.id as string;
    await request(server()).post('/auth/login').set('User-Agent', UA).send({ login: emailOf('acc'), password: 'NOTOGRI-PAROL-777' });
    const ok = await request(server()).post('/auth/login').set('User-Agent', UA).send({ login: emailOf('acc'), password: PASSWORD });
    await request(server()).post('/auth/change-password').set({ Authorization: `Bearer ${ok.body.accessToken}`, 'User-Agent': UA })
      .send({ currentPassword: PASSWORD, newPassword: 'yangi-parol-99' });
    await request(server()).post('/auth/logout').set('User-Agent', UA).send({ refreshToken: ok.body.refreshToken });
    await settle();

    const log = await rows(id);
    expect(log.map((r) => r.type)).toEqual(['register', 'login_failed', 'login', 'password_change', 'logout']);
    expect(log[1]).toMatchObject({ meta: { reason: 'bad_credentials' } });
    for (const r of log) {
      expect(r.device).toBe(UA);
      expect(r.ip).toBeTruthy();
    }
    const dump = JSON.stringify(log);
    for (const secret of ['NOTOGRI-PAROL-777', PASSWORD, 'yangi-parol-99', emailOf('acc')]) expect(dump).not.toContain(secret);
    // Noma'lum login: userId yo'q, baribir yoziladi
    await request(server()).post('/auth/login').set('User-Agent', UA).send({ login: `yoq${domain}`, password: 'x'.repeat(8) });
    await settle();
    const ghost = await prisma.activityLog.findFirst({ where: { type: 'login_failed', userId: null, device: UA }, orderBy: { createdAt: 'desc' } });
    expect(ghost).not.toBeNull();
    expect(JSON.stringify(ghost)).not.toContain('yoq');
  });

  it('chat hodisalari: chat_create (idempotent), channel_create, group_join/leave, message_send/message_delete — matn jurnalga tushmaydi', async () => {
    const direct = await api.ali.createDirectChat(user.vali.id);
    await api.vali.createDirectChat(user.ali.id); // bor chat — qayta "yaratildi" yozilmaydi
    const channel = await api.ali.createChannel({ title: `Kanal ${stamp}`, isPublic: true });
    await api.vali.joinChannel(channel.id);
    await api.vali.leaveChat(channel.id);
    const msg = await api.ali.sendMessage(direct.id, { content: SECRET_TEXT });
    await api.ali.sendMessage(channel.id, { content: `${SECRET_TEXT} kanal` });
    await api.ali.deleteMessage(direct.id, msg.id);
    await settle();

    const ali = await rows(user.ali.id);
    const kinds = ali.filter((r) => r.chatId).map((r) => `${r.type}:${r.chatKind}`);
    expect(kinds).toEqual([
      'chat_create:private', 'channel_create:channel', 'message_send:private', 'message_send:channel', 'message_delete:private',
    ]);
    expect(ali.find((r) => r.type === 'message_send' && r.chatKind === 'private')?.meta).toEqual({ length: SECRET_TEXT.length, hasAttachment: false });
    expect(ali.find((r) => r.type === 'channel_create')?.chatPublic).toBe(true);
    expect((await rows(user.vali.id)).filter((r) => r.chatId).map((r) => `${r.type}:${r.chatKind}`)).toEqual(['group_join:channel', 'group_leave:channel']);

    // Matn jadvalning hech qaysi ustunida yo'q
    const leak = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM activity_log a WHERE a::text LIKE ${'%' + SECRET_TEXT + '%'}`;
    expect(leak[0].n).toBe(0);
    // Admin API javoblarida ham yo'q
    const list = await get(token.boss, `/admin/activity?userId=${user.ali.id}&pageSize=100`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(SECRET_TEXT);
    expect((list.body as AdminActivityList).items.every((e) => e.userLabel?.includes(`ali ${stamp}`))).toBe(true);
  });

  it('media: 1:1 mazmuni admin API\'da qaytmaydi; ochiq kanal — prevyu; shikoyat qilingan xabar — mazmun ochiladi', async () => {
    const direct = await api.ali.createDirectChat(user.vali.id);
    const channel = await api.ali.createChannel({ title: `Ochiq ${stamp}`, isPublic: true });
    const hidden = await sendImage('ali', direct.id, `shaxsiy-${stamp}.png`);
    const open = await sendImage('ali', channel.id, `ochiq-${stamp}.png`);
    await settle();

    const media = (await get(token.boss, `/admin/media?userId=${user.ali.id}`)).body as AdminMediaList;
    const byName = (n: string) => media.items.find((m) => m.media?.name === n)!;
    expect(byName(`shaxsiy-${stamp}.png`)).toMatchObject({
      type: 'media_upload', chatKind: 'private',
      media: { kind: 'image', mime: 'image/png', size: 2048, attachmentId: hidden.attachment!.id, previewable: false },
    });
    expect(byName(`ochiq-${stamp}.png`)).toMatchObject({ chatKind: 'channel', chatPublic: true, media: { previewable: true } });
    expect(media.stats.totalCount).toBeGreaterThanOrEqual(2);
    expect(media.stats.byKind.find((k) => k.kind === 'image')!.bytes).toBeGreaterThanOrEqual(4096);
    // Hech qaysi javobda biriktirma havolasi (/media/blob) yo'q
    expect(JSON.stringify(media)).not.toContain('/media/blob');

    // Prevyu: 1:1 — 403 (URL berilmaydi), ochiq kanal — 200
    const denied = await get(token.boss, `/admin/media/${hidden.attachment!.id}/preview`);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain('/media/blob');
    const allowed = await get(token.boss, `/admin/media/${open.attachment!.id}/preview`);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({ kind: 'image', mime: 'image/png' });
    expect((await fetch(allowed.body.url)).status).toBe(200);

    // Shikoyat: hali yo'q -> reports'da u xabar yo'q
    const before = (await get(token.boss, '/admin/reports')).body as AdminReportList;
    expect(before.items.find((r) => r.message.id === hidden.id)).toBeUndefined();
    // Begona xabarga shikoyat: o'z xabariga mumkin emas
    const own = await request(server()).post(`/chats/${direct.id}/messages/${hidden.id}/report`).set({ Authorization: `Bearer ${token.ali}` }).send({});
    expect(own.status).toBe(400);
    const text = await api.ali.sendMessage(direct.id, { content: `${SECRET_TEXT} shikoyat` });
    const rep = await request(server()).post(`/chats/${direct.id}/messages/${hidden.id}/report`).set({ Authorization: `Bearer ${token.vali}` }).send({ reason: 'noto\'g\'ri rasm' });
    expect(rep.status).toBe(204);
    await request(server()).post(`/chats/${direct.id}/messages/${text.id}/report`).set({ Authorization: `Bearer ${token.vali}` }).send({});
    await settle();

    const after = (await get(token.boss, '/admin/reports')).body as AdminReportList;
    const reported = after.items.find((r) => r.message.id === text.id)!;
    expect(reported).toMatchObject({ chatKind: 'private', message: { content: `${SECRET_TEXT} shikoyat`, senderId: user.ali.id } });
    // Shikoyat qilinmagan xabarlar matni (msg: SECRET_TEXT) baribir yo'q
    expect(JSON.stringify(after)).not.toContain(`${SECRET_TEXT}"`);
    expect((await get(token.boss, `/admin/media/${hidden.attachment!.id}/preview`)).status).toBe(200); // endi ochiq
    expect((await rows(user.vali.id)).filter((r) => r.type === 'report')).toHaveLength(2);
    const stillHidden = await sendImage('ali', direct.id, `boshqa-${stamp}.png`);
    expect((await get(token.boss, `/admin/media/${stillHidden.attachment!.id}/preview`)).status).toBe(403);
  });

  it('filtrlar, sahifalash, umumiy statistika', async () => {
    const byType = (await get(token.boss, `/admin/activity?type=register&userId=${user.ali.id}`)).body as AdminActivityList;
    expect(byType.items.map((e) => e.type)).toEqual(['register']);
    expect(((await get(token.boss, `/admin/activity?chatKind=channel&userId=${user.ali.id}`)).body as AdminActivityList).items.every((e) => e.chatKind === 'channel')).toBe(true);
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(((await get(token.boss, `/admin/activity?from=${encodeURIComponent(future)}&userId=${user.ali.id}`)).body as AdminActivityList).total).toBe(0);
    expect(((await get(token.boss, `/admin/activity?to=${encodeURIComponent(future)}&userId=${user.ali.id}`)).body as AdminActivityList).total).toBeGreaterThan(3);
    const p1 = (await get(token.boss, `/admin/activity?userId=${user.ali.id}&pageSize=2&page=1`)).body as AdminActivityList;
    const p2 = (await get(token.boss, `/admin/activity?userId=${user.ali.id}&pageSize=2&page=2`)).body as AdminActivityList;
    expect(p1.items).toHaveLength(2);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
    expect((await get(token.boss, '/admin/activity?type=nomalum')).status).toBe(400);

    const o = (await get(token.boss, '/admin/overview')).body as AdminOverview;
    expect(o.activeToday).toBeGreaterThanOrEqual(3);
    expect(o.newUsersToday).toBeGreaterThanOrEqual(3);
    expect(o.mediaBytesTotal).toBeGreaterThanOrEqual(6144);
    expect(o.mediaBytes24h).toBeGreaterThanOrEqual(6144);
  });

  it('retention: ACTIVITY_RETENTION_DAYS dan eskilari tozalanadi, yangilari qoladi', async () => {
    const DAY = 86_400_000;
    const old = await prisma.activityLog.create({ data: { type: 'login', userId: user.vali.id, device: `old-${stamp}`, createdAt: new Date(Date.now() - 100 * DAY) } });
    const mid = await prisma.activityLog.create({ data: { type: 'login', userId: user.vali.id, device: `mid-${stamp}`, createdAt: new Date(Date.now() - 40 * DAY) } });
    expect(activity.retentionDays).toBe(90);
    expect(await activity.cleanup()).toBeGreaterThanOrEqual(1);
    expect(await prisma.activityLog.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.activityLog.findUnique({ where: { id: mid.id } })).not.toBeNull();

    process.env.ACTIVITY_RETENTION_DAYS = '30';
    try {
      expect(activity.retentionDays).toBe(30);
      await activity.cleanup();
      expect(await prisma.activityLog.findUnique({ where: { id: mid.id } })).toBeNull();
    } finally {
      delete process.env.ACTIVITY_RETENTION_DAYS;
    }
    // Maxfiylik sahifasi muddatni rost aytadi (tokensiz)
    expect((await request(server()).get('/privacy')).body).toEqual({ retentionDays: 90 });
  });

  it('jurnal yozilmasa asosiy amal buzilmaydi (xato log qilinadi)', async () => {
    const direct = await api.ali.createDirectChat(user.vali.id);
    const create = vi.fn().mockRejectedValue(new Error('baza yiqildi'));
    const holder = activity as unknown as { prisma: unknown };
    const real = holder.prisma;
    holder.prisma = { chat: prisma.chat, activityLog: { create } };
    try {
      const msg = await api.ali.sendMessage(direct.id, { content: 'jurnalsiz' });
      expect(msg.content).toBe('jurnalsiz');
      await settle();
      expect(create).toHaveBeenCalled();
    } finally {
      holder.prisma = real;
    }
  });

  it('admin bo\'lmaganga yangi endpointlar 404', async () => {
    for (const path of ['/admin/activity', '/admin/media', '/admin/overview', '/admin/reports', `/admin/media/${user.ali.id}/preview`]) {
      expect((await get(token.ali, path)).status, path).toBe(404);
      expect((await request(server()).get(path)).status, `${path} (tokensiz)`).toBe(404);
    }
  });
});
