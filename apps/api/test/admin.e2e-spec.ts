// Admin panel (haqiqiy Postgres + Socket.IO): ruxsat, ro'yxat, bloklash, vaqtinchalik parol,
// tiklash kodlari, o'chirish (bulk), audit, rate limit.
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { SocketClient } from '@suhbat/client';
import { RECOVERY_CODE_COUNT } from '@suhbat/core';
import type { AdminAuditList, AdminBulkDeleteResult, AdminUserList } from '@suhbat/core';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ensureStorage, waitConnected } from './helpers';

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const domain = `-${stamp}@admin.e2e.uz`;
const emailOf = (n: string) => `${n}${domain}`;
const PASSWORD = '12345678';

describe('Admin panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  let storage: Awaited<ReturnType<typeof ensureStorage>>;
  const savedAdminEmails = process.env.ADMIN_EMAILS;
  const sockets: SocketClient[] = [];
  const server = () => app.getHttpServer();

  const register = async (name: string) => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: emailOf(name), password: PASSWORD, displayName: `${name} ${stamp}`, username: `${name}_${stamp}`.toLowerCase() });
    expect(res.status).toBe(201);
    return { id: res.body.user.id as string, token: res.body.accessToken as string, refresh: res.body.refreshToken as string };
  };
  const login = (name: string, password = PASSWORD) =>
    request(server()).post('/auth/login').send({ login: emailOf(name), password });
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = (token: string, path: string) => request(server()).get(path).set(as(token));
  const post = (token: string, path: string, body?: object) => request(server()).post(path).set(as(token)).send(body);

  let admin: Awaited<ReturnType<typeof register>>;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = ` ${emailOf('boss').toUpperCase()} , other@nowhere.uz`;
    storage = await ensureStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    admin = await register('boss');
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { endsWith: domain } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.adminAuditLog.deleteMany({ where: { adminEmail: emailOf('boss') } });
    await app.close();
    await storage.close();
    if (savedAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = savedAdminEmails;
  });

  it('admin bo\'lmaganga hamma yo\'l 404 (tokensiz ham, oddiy foydalanuvchi ham); /auth/me isAdmin', async () => {
    const plain = await register('plain');
    const routes: [string, string][] = [
      ['get', '/admin/users'], ['get', '/admin/audit'], ['post', '/admin/users/bulk-delete'],
      ['post', `/admin/users/${plain.id}/block`], ['post', `/admin/users/${plain.id}/temp-password`], ['delete', `/admin/users/${plain.id}`],
    ];
    for (const [method, path] of routes) {
      const anon = await (request(server()) as unknown as Record<string, (p: string) => request.Test>)[method](path);
      expect(anon.status, `${method} ${path} (tokensiz)`).toBe(404);
      const user = await (request(server()) as unknown as Record<string, (p: string) => request.Test>)[method](path).set(as(plain.token));
      expect(user.status, `${method} ${path} (oddiy)`).toBe(404);
    }
    expect((await get(plain.token, '/auth/me')).body.isAdmin).toBe(false);
    expect((await get(admin.token, '/auth/me')).body.isAdmin).toBe(true);
    expect((await get(admin.token, '/admin/users')).status).toBe(200);
  });

  it('ro\'yxat: qidiruv, sahifalash, maydonlar; parol/hash/kod HECH QACHON qaytmaydi', async () => {
    const ali = await register('omad');
    await register('baxt');
    await prisma.recoveryCode.create({ data: { userId: ali.id, codeHash: 'secret-code-hash-xyz' } });
    await login('omad'); // ikkinchi qurilma (ikkinchi token oilasi)

    const res = await get(admin.token, `/admin/users?q=${encodeURIComponent(`omad_${stamp}`)}`);
    expect(res.status).toBe(200);
    const list = res.body as AdminUserList;
    expect(list.total).toBe(1);
    expect(list.items[0]).toEqual({
      id: ali.id, username: `omad_${stamp}`.toLowerCase(), displayName: `omad ${stamp}`, email: emailOf('omad'),
      createdAt: expect.any(String), lastSeenAt: null, hasRecoveryCodes: true, activeSessions: 2,
      blocked: false, mustChangePassword: false, isAdmin: false,
    });
    const raw = JSON.stringify(res.body);
    for (const leak of ['passwordHash', 'password_hash', 'argon2', 'codeHash', 'secret-code-hash-xyz']) expect(raw).not.toContain(leak);

    // Qidiruv email va ism bo'yicha ham (katta-kichik harf farqsiz); @ bilan username
    expect((await get(admin.token, `/admin/users?q=${emailOf('BAXT').toUpperCase()}`)).body.total).toBe(1);
    expect((await get(admin.token, `/admin/users?q=${encodeURIComponent(`@BAXT_${stamp}`)}`)).body.total).toBe(1);
    expect((await get(admin.token, `/admin/users?q=${encodeURIComponent(`omad ${stamp}`)}`)).body.total).toBe(1);

    // Sahifalash: admin.e2e.uz domenidagi (3 ta+) foydalanuvchi, pageSize=1
    const p1 = (await get(admin.token, `/admin/users?q=${encodeURIComponent(domain)}&page=1&pageSize=1`)).body as AdminUserList;
    const p2 = (await get(admin.token, `/admin/users?q=${encodeURIComponent(domain)}&page=2&pageSize=1`)).body as AdminUserList;
    expect(p1.items).toHaveLength(1);
    expect(p2.items).toHaveLength(1);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
    expect(p1.total).toBeGreaterThanOrEqual(3);
    expect((await get(admin.token, '/admin/users?pageSize=1000')).status).toBe(400);
    expect((await get(admin.token, `/admin/users?q=${emailOf('boss')}`)).body.items[0].isAdmin).toBe(true);
  });

  it('block: login 403, sessiyalar va access token bekor, socket uziladi; unblock: yana kiradi', async () => {
    const u = await register('blk');
    const api = createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
    await api.login({ login: emailOf('blk'), password: PASSWORD });
    const sock = createSocketClient({ url, getAccessToken: api.getAccessToken, refreshAccessToken: api.refreshAccessToken });
    sockets.push(sock);
    sock.connect();
    await waitConnected(sock);
    const dropped = new Promise<void>((resolve) => { const off = sock.onConnectionChange((up) => { if (!up) { off(); resolve(); } }); });

    expect((await post(admin.token, `/admin/users/${u.id}/block`)).status).toBe(204);
    await dropped;

    expect((await login('blk')).status).toBe(403);
    expect((await request(server()).post('/auth/refresh').send({ refreshToken: u.refresh })).status).toBe(401);
    expect((await get(u.token, '/auth/me')).status).toBe(401); // hali muddati o'tmagan access token ham
    const listed = (await get(admin.token, `/admin/users?q=blk_${stamp}`)).body as AdminUserList;
    expect(listed.items[0]).toMatchObject({ blocked: true, activeSessions: 0 });

    expect((await post(admin.token, `/admin/users/${u.id}/unblock`)).status).toBe(204);
    expect((await login('blk')).status).toBe(200);
  });

  it('revoke-sessions: refresh token ishlamaydi, parol o\'zgarmaydi', async () => {
    const u = await register('rev');
    expect((await post(admin.token, `/admin/users/${u.id}/revoke-sessions`)).status).toBe(204);
    expect((await request(server()).post('/auth/refresh').send({ refreshToken: u.refresh })).status).toBe(401);
    expect((await login('rev')).status).toBe(200);
  });

  it('temp-password: bir marta qaytadi, eski parol ishlamaydi, kirgach almashtirish majburiy', async () => {
    const u = await register('tmp');
    const res = await post(admin.token, `/admin/users/${u.id}/temp-password`);
    expect(res.status).toBe(200);
    const temp = res.body.temporaryPassword as string;
    expect(temp.replace(/-/g, '')).toHaveLength(16);
    expect((await get(admin.token, `/admin/users?q=tmp_${stamp}`)).body.items[0].mustChangePassword).toBe(true);
    expect(JSON.stringify((await get(admin.token, `/admin/users?q=tmp_${stamp}`)).body)).not.toContain(temp);
    expect((await request(server()).post('/auth/refresh').send({ refreshToken: u.refresh })).status).toBe(401);

    expect((await login('tmp')).status).toBe(401); // eski parol
    const ok = await login('tmp', temp);
    expect(ok.status).toBe(200);
    expect(ok.body.user.mustChangePassword).toBe(true);
    const token = ok.body.accessToken as string;

    // Almashtirilguncha: faqat /auth/me va change-password
    expect((await get(token, '/auth/me')).body.mustChangePassword).toBe(true);
    expect((await get(token, '/chats')).status).toBe(403);
    expect((await post(token, '/auth/change-password', { currentPassword: temp, newPassword: 'yangi-parol-1' })).status).toBe(200);
    const after = await login('tmp', 'yangi-parol-1');
    expect(after.status).toBe(200);
    expect(after.body.user.mustChangePassword).toBe(false);
    expect((await get(after.body.accessToken, '/chats')).status).toBe(200);
    expect((await login('tmp', temp)).status).toBe(401); // vaqtinchalik parol bir martalik

    // O'ziga bermaydi
    expect((await post(admin.token, `/admin/users/${admin.id}/temp-password`)).status).toBe(400);
  });

  it('recovery-codes: yangi 10 kod bir marta, eskilari bekor, kod bilan parol tiklanadi', async () => {
    const u = await register('rcv');
    const first = await post(admin.token, `/admin/users/${u.id}/recovery-codes`);
    expect(first.status).toBe(200);
    expect(first.body.codes).toHaveLength(RECOVERY_CODE_COUNT);
    const second = await post(admin.token, `/admin/users/${u.id}/recovery-codes`);
    const oldCode = first.body.codes[0] as string;
    const newCode = second.body.codes[0] as string;
    const recover = (code: string) => request(server()).post('/auth/recover').send({ login: emailOf('rcv'), code, newPassword: 'tiklangan-1' });
    expect((await recover(oldCode)).status).toBe(400);
    expect((await recover(newCode)).status).toBe(204);
    expect(JSON.stringify((await get(admin.token, `/admin/users?q=rcv_${stamp}`)).body)).not.toContain(newCode);
  });

  it('bulk-delete: chatlar va hisoblar o\'chadi; o\'zi ro\'yxatda bo\'lsa 400 va hech kim o\'chmaydi; yo\'q id — notFound', async () => {
    const a = await register('del1');
    const b = await register('del2');
    const keep = await register('keep');
    // del1 va keep o'rtasida 1:1 chat, del1 egasi bo'lgan guruhga keep a'zo
    const direct = await post(a.token, '/chats/direct', { userId: keep.id });
    expect(direct.status).toBeLessThan(300);
    const group = await post(a.token, '/chats/group', { title: `G ${stamp}`, memberIds: [keep.id] });
    expect(group.status).toBeLessThan(300);

    const self = await post(admin.token, '/admin/users/bulk-delete', { ids: [a.id, admin.id] });
    expect(self.status).toBe(400);
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(1);

    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await post(admin.token, '/admin/users/bulk-delete', { ids: [a.id, b.id, ghost] });
    expect(res.status).toBe(200);
    const body = res.body as AdminBulkDeleteResult;
    expect(body.deleted.sort()).toEqual([a.id, b.id].sort());
    expect(body.notFound).toEqual([ghost]);
    expect(await prisma.user.count({ where: { id: { in: [a.id, b.id] } } })).toBe(0);
    expect(await prisma.chat.count({ where: { id: direct.body.id } })).toBe(0); // 1:1 chat ketdi
    const members = await prisma.chatMember.findMany({ where: { chatId: group.body.id } });
    expect(members).toEqual([expect.objectContaining({ userId: keep.id, role: 'owner' })]); // guruhga yangi ega
    expect((await get(keep.token, '/auth/me')).status).toBe(200); // boshqalar daxlsiz

    expect((await post(admin.token, '/admin/users/bulk-delete', { ids: [] })).status).toBe(400);
    expect((await post(admin.token, '/admin/users/bulk-delete', { ids: ['x'] })).status).toBe(400);
  });

  it('DELETE /admin/users/:id: o\'zini o\'chira olmaydi, yo\'q id — 404, mavjud — 204 va kirish yopiladi', async () => {
    const u = await register('one');
    expect((await request(server()).delete(`/admin/users/${admin.id}`).set(as(admin.token))).status).toBe(400);
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(1);
    expect((await request(server()).delete('/admin/users/00000000-0000-4000-8000-000000000000').set(as(admin.token))).status).toBe(404);
    expect((await request(server()).delete('/admin/users/not-a-uuid').set(as(admin.token))).status).toBe(400);
    expect((await request(server()).delete(`/admin/users/${u.id}`).set(as(admin.token))).status).toBe(204);
    expect((await login('one')).status).toBe(401);
    expect((await get(u.token, '/auth/me')).status).toBe(401);
  });

  it('audit: kim, qachon, amal, kimga — o\'chirilgan foydalanuvchi uchun ham saqlanadi; parol yozilmaydi', async () => {
    const res = await get(admin.token, '/admin/audit?pageSize=100');
    expect(res.status).toBe(200);
    const audit = res.body as AdminAuditList;
    const mine = audit.items.filter((e) => e.adminEmail === emailOf('boss'));
    const actions = new Set(mine.map((e) => e.action));
    for (const a of ['user.block', 'user.unblock', 'user.revoke_sessions', 'user.temp_password', 'user.recovery_codes', 'user.delete']) {
      expect(actions, a).toContain(a);
    }
    const deleted = mine.find((e) => e.action === 'user.delete' && e.targetLabel === `@one_${stamp}`);
    expect(deleted).toMatchObject({ adminId: admin.id, targetUserId: expect.any(String), createdAt: expect.any(String) });
    expect(await prisma.user.count({ where: { id: deleted!.targetUserId } })).toBe(0);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/argon2|passwordHash|temporaryPassword/);
    // Yangidan eskiga
    const times = mine.map((e) => Date.parse(e.createdAt));
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect(audit.total).toBeGreaterThanOrEqual(mine.length);
  });

  it('bloklangan admin panelga kira olmaydi (404)', async () => {
    const boss2Email = emailOf('boss2');
    process.env.ADMIN_EMAILS += `,${boss2Email}`;
    const boss2 = await register('boss2');
    expect((await get(boss2.token, '/admin/users')).status).toBe(200);
    expect((await post(admin.token, `/admin/users/${boss2.id}/block`)).status).toBe(204);
    expect((await get(boss2.token, '/admin/users')).status).toBe(404);
  });
});

describe('Admin rate limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const savedEnv = { ...process.env };
  const email = `rl${domain}`;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = email;
    process.env.ADMIN_READ_LIMIT = '3';
    process.env.ADMIN_WRITE_LIMIT = '2';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: domain } } });
    await prisma.adminAuditLog.deleteMany({ where: { adminEmail: email } });
    await app.close();
    for (const k of ['ADMIN_EMAILS', 'ADMIN_READ_LIMIT', 'ADMIN_WRITE_LIMIT']) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('o\'qish va o\'zgartirish endpointlari 429 beradi', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password: PASSWORD, displayName: 'RL' });
    const h = { Authorization: `Bearer ${res.body.accessToken as string}` };
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await request(app.getHttpServer()).get('/admin/users').set(h)).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    const ghost = '00000000-0000-4000-8000-000000000000';
    const w: number[] = [];
    for (let i = 0; i < 3; i++) w.push((await request(app.getHttpServer()).post(`/admin/users/${ghost}/unblock`).set(h)).status);
    expect(w).toEqual([404, 404, 429]);
  });
});
