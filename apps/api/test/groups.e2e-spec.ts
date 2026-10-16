// Haqiqiy Postgres + Socket.IO: guruh, kanal, a'zolik/rollar, tahrirlash/o'chirish,
// media (imzolangan URL), qidiruv (email sizib chiqmasligi), token muddati.
import 'dotenv/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApiClient, createSocketClient, memoryTokenStorage } from '@suhbat/client';
import type { ApiClient, SocketClient } from '@suhbat/client';
import type { User } from '@suhbat/core';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { SocketIoAdapter } from '../src/common/socket-io.adapter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ensureStorage, never, next, waitConnected } from './helpers';

const stamp = `g${Date.now()}`;
const emailOf = (n: string) => `${n}-${stamp}@e2e.uz`;
const names = ['ali', 'vali', 'gani', 'hasan'] as const;
type Name = (typeof names)[number];

const png = (n: number) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/png' });

describe('Guruh, kanal, media (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let prisma: PrismaService;
  let storage: Awaited<ReturnType<typeof ensureStorage>>;
  const sockets: SocketClient[] = [];
  const api = {} as Record<Name, ApiClient>;
  const user = {} as Record<Name, User>;
  const ws = {} as Record<Name, SocketClient>;

  const mkApi = () => createApiClient({ baseUrl: url, storage: memoryTokenStorage() });
  const mkSocket = (a: ApiClient) => {
    const s = createSocketClient({ url, getAccessToken: a.getAccessToken, refreshAccessToken: a.refreshAccessToken });
    sockets.push(s);
    return s;
  };

  beforeAll(async () => {
    storage = await ensureStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new SocketIoAdapter(app, true));
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);

    for (const n of names) {
      api[n] = mkApi();
      user[n] = await api[n].register({ email: emailOf(n), password: '12345678', displayName: `${n} ${stamp}` });
      ws[n] = mkSocket(api[n]);
      ws[n].connect();
      await waitConnected(ws[n]);
    }
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const users = await prisma.user.findMany({ where: { email: { endsWith: `-${stamp}@e2e.uz` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.chat.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    await storage.close();
  });

  it('/users/search: email faqat to\'liq mos kelganda topiladi, ism bo\'yicha qism', async () => {
    const { ali, vali } = api;
    const email = emailOf('vali');
    expect(await ali.searchUsers(`vali-${stamp}`)).toEqual([]); // email qismi — topilmaydi
    expect(await ali.searchUsers(`@e2e.uz`)).toEqual([]);
    expect(await ali.searchUsers(email.slice(0, -3))).toEqual([]);
    expect((await ali.searchUsers(email.toUpperCase())).map((u) => u.id)).toEqual([user.vali.id]); // to'liq (katta-kichik farqsiz)
    expect((await ali.searchUsers(`vali ${stamp}`)).map((u) => u.id)).toEqual([user.vali.id]); // ism: qism
    expect((await ali.searchUsers(`ALI ${stamp}`.slice(0, 8))).every((u) => u.id !== user.ali.id)).toBe(true);
    expect(await vali.searchUsers(emailOf('vali'))).toEqual([]); // o'zini qaytarmaydi
  });

  it('email boshqalarga SIZMAYDI: qidiruv, chat a\'zolari, ro\'yxat, WS; faqat o\'zi uchun bor', async () => {
    // Mijoz zod bilan "email"ni tashlab yuboradi — shuning uchun xom HTTP/WS javoblari tekshiriladi.
    const get = async (n: Name, path: string) => {
      const res = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${(await api[n].getAccessToken())!}` } });
      expect(res.status).toBe(200);
      return res.json() as Promise<unknown>;
    };
    const hasEmail = (v: unknown) => JSON.stringify(v).includes('@e2e.uz');

    // Ism bo'yicha qidiruv (qisqa q ham) — email maydoni yo'q
    const byName = (await get('ali', `/users/search?q=vali%20${stamp}`)) as Record<string, unknown>[];
    expect(byName).toHaveLength(1);
    expect(byName[0]).not.toHaveProperty('email');
    expect(Object.keys(byName[0]).sort()).toEqual(['bio', 'createdAt', 'displayName', 'id', 'photoUrl', 'username']);
    expect(hasEmail(await get('ali', '/users/search?q=a'))).toBe(false);
    // To'liq email bilan topilganda ham javobda email yo'q
    const byEmail = (await get('ali', `/users/search?q=${encodeURIComponent(emailOf('vali'))}`)) as Record<string, unknown>[];
    expect(byEmail).toHaveLength(1);
    expect(byEmail[0]).not.toHaveProperty('email');

    // Chat a'zolari: GET /chats/:id va /chats ro'yxati
    const direct = await api.ali.createDirectChat(user.vali.id);
    const group = await api.ali.createGroup({ title: `Maxfiy ${stamp}`, memberIds: [user.vali.id] });
    const one = await get('vali', `/chats/${group.id}`);
    expect(hasEmail(one)).toBe(false);
    expect(hasEmail(await get('vali', '/chats'))).toBe(false);
    expect(hasEmail(await get('ali', `/chats/${direct.id}`))).toBe(false);

    // WS: chat:member voqeasi emailsiz
    const raw = next(ws.vali, 'chat:member', (e) => e.action === 'added' && e.userId === user.gani.id);
    await api.ali.addMembers(group.id, [user.gani.id]);
    expect(hasEmail(await raw)).toBe(false);
    await api.ali.deleteChat(group.id);

    // O'zi uchun email bor: /auth/me, login
    expect(await get('ali', '/auth/me')).toMatchObject({ email: emailOf('ali') });
    const login = await fetch(`${url}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailOf('ali'), password: '12345678' }),
    });
    expect(((await login.json()) as { user: { email: string } }).user.email).toBe(emailOf('ali'));
  });

  it('guruh: yaratish, a\'zo qo\'shish/chiqarish, rollar, sozlamalar, o\'chirish + WS voqealari', async () => {
    const { ali, vali, gani } = api;
    const valiAdded = next(ws.vali, 'chat:member', (e) => e.userId === user.vali.id && e.action === 'added');
    const group = await ali.createGroup({ title: ` Do'stlar ${stamp} `, description: 'Tavsif', memberIds: [user.vali.id, user.vali.id] });
    expect(group).toMatchObject({ type: 'group', title: `Do'stlar ${stamp}`, description: 'Tavsif', isPublic: false, memberCount: 2 });
    expect(group.members.map((m) => [m.user.id, m.role]).sort()).toEqual(
      [[user.ali.id, 'owner'], [user.vali.id, 'member']].sort(),
    );
    const added = await valiAdded;
    expect(added).toMatchObject({ chatId: group.id, action: 'added', memberCount: 2, member: { role: 'member' } });
    expect((await vali.getChat(group.id)).id).toBe(group.id);
    await expect(gani.getChat(group.id)).rejects.toMatchObject({ status: 404 });
    await expect(ali.createGroup({ title: 'x', memberIds: ['00000000-0000-4000-8000-000000000000'] })).rejects.toMatchObject({ status: 404 });

    // Guruhda hamma yozadi
    const aliGets = next(ws.ali, 'message:new', (e) => e.message.content === 'salom guruh');
    await ws.vali.sendMessage({ chatId: group.id, content: 'salom guruh' });
    expect((await aliGets).message.senderId).toBe(user.vali.id);

    // Oddiy a'zo boshqaruv qila olmaydi
    await expect(vali.addMembers(group.id, [user.gani.id])).rejects.toMatchObject({ status: 403 });
    await expect(vali.updateChat(group.id, { title: 'hack' })).rejects.toMatchObject({ status: 403 });
    await expect(vali.removeMember(group.id, user.ali.id)).rejects.toMatchObject({ status: 403 });
    await expect(vali.deleteChat(group.id)).rejects.toMatchObject({ status: 403 });
    await expect(ali.updateChat(group.id, { isPublic: true })).rejects.toMatchObject({ status: 400 }); // guruh ochiq bo'lmaydi

    // Ali Gani'ni qo'shadi: Gani, Vali va Ali voqea oladi
    const ganiAdded = next(ws.gani, 'chat:member', (e) => e.action === 'added');
    const valiSees = next(ws.vali, 'chat:member', (e) => e.userId === user.gani.id && e.action === 'added');
    const withGani = await ali.addMembers(group.id, [user.gani.id, user.vali.id]); // Vali allaqachon a'zo — e'tiborsiz
    expect(withGani.memberCount).toBe(3);
    expect((await ganiAdded).chatId).toBe(group.id);
    expect((await valiSees).memberCount).toBe(3);
    expect((await gani.getChat(group.id)).memberCount).toBe(3);

    // Sozlamalarni o'zgartirish → hamma `chat:updated` oladi
    const updated = next(ws.gani, 'chat:updated');
    const renamed = await ali.updateChat(group.id, { title: 'Yangi nom', description: '' });
    expect(renamed).toMatchObject({ title: 'Yangi nom', description: null });
    expect(await updated).toMatchObject({ chatId: group.id, title: 'Yangi nom', description: null, isPublic: false });

    // Rollar: faqat ega. Vali admin bo'ladi
    await expect(vali.setMemberRole(group.id, user.gani.id, 'admin')).rejects.toMatchObject({ status: 403 });
    const roleEvent = next(ws.gani, 'chat:member', (e) => e.action === 'role');
    const m = await ali.setMemberRole(group.id, user.vali.id, 'admin');
    expect(m.role).toBe('admin');
    expect((await roleEvent).member?.role).toBe('admin');
    await expect(ali.setMemberRole(group.id, user.ali.id, 'member')).rejects.toMatchObject({ status: 400 }); // egasining roli

    // Admin oddiy a'zoni chiqaradi, egani yo'q
    await expect(vali.removeMember(group.id, user.ali.id)).rejects.toMatchObject({ status: 403 });
    const ganiRemoved = next(ws.gani, 'chat:member', (e) => e.action === 'removed' && e.userId === user.gani.id);
    await vali.removeMember(group.id, user.gani.id);
    expect(await ganiRemoved).toMatchObject({ member: null, memberCount: 2 });
    await expect(gani.getChat(group.id)).rejects.toMatchObject({ status: 404 });
    await expect(gani.listMessages(group.id)).rejects.toMatchObject({ status: 404 });
    await expect(ws.gani.sendMessage({ chatId: group.id, content: 'kirib oldim' })).rejects.toThrow('Chat topilmadi');

    // Admin guruhdagi birovning xabarini o'chira oladi; oddiy a'zo — yo'q
    await ali.addMembers(group.id, [user.gani.id]);
    const ganiMsg = await ws.gani.sendMessage({ chatId: group.id, content: 'spam' });
    await expect(api.hasan.deleteMessage(group.id, ganiMsg.id)).rejects.toMatchObject({ status: 404 });
    await vali.deleteMessage(group.id, ganiMsg.id);

    // Chiqish: ega chiqa olmaydi, oddiy a'zo chiqadi
    await expect(ali.leaveChat(group.id)).rejects.toMatchObject({ status: 403 });
    await gani.leaveChat(group.id);
    expect((await ali.getChat(group.id)).memberCount).toBe(2);

    // Egasi chatni o'chiradi → a'zolar `chat:deleted` oladi
    const deleted = next(ws.vali, 'chat:deleted');
    await ali.deleteChat(group.id);
    expect(await deleted).toEqual({ chatId: group.id });
    await expect(vali.getChat(group.id)).rejects.toMatchObject({ status: 404 });
  });

  it('kanal: "Obunachi qo\'shish" bilan qo\'shilgan oddiy a\'zo — rol `member`, ega/adminlar ro\'yxatiga tushmaydi', async () => {
    const { ali, hasan } = api;
    const ch = await ali.createChannel({ title: `Rollar ${stamp}`, isPublic: false });
    const withHasan = await ali.addMembers(ch.id, [user.hasan.id]);
    expect(withHasan.memberCount).toBe(2);

    // Obunachi o'z ko'rinishida: ega (`owner`) + o'zi (`member`, `myRole` uchun). UI faqat `owner/admin`ni
    // "Ega va adminlar"da ko'rsatadi, obunachilar soni = memberCount − bular.
    const asHasan = await hasan.getChat(ch.id);
    expect(asHasan.memberCount).toBe(2);
    const roles = Object.fromEntries(asHasan.members.map((m) => [m.user.id, m.role]));
    expect(roles).toEqual({ [user.ali.id]: 'owner', [user.hasan.id]: 'member' });

    // Ega ko'rinishida: faqat o'zi (obunachi API javobiga tushmaydi — kanal katta bo'lishi mumkin)
    const asAli = await ali.getChat(ch.id);
    expect(asAli.members.map((m) => [m.user.id, m.role])).toEqual([[user.ali.id, 'owner']]);
    expect(asAli.memberCount).toBe(2);
    await ali.deleteChat(ch.id);
  });

  it('PATCH /users/me: ism va bio, validatsiya, boshqalar yangilangan profilni ko\'radi', async () => {
    const { ali, vali } = api;
    const base = `Profil ${stamp}`;
    const updated = await ali.updateProfile({ displayName: `  ${base}  `, bio: '  Dasturchi  ' });
    expect(updated).toMatchObject({ id: user.ali.id, email: emailOf('ali'), displayName: base, bio: 'Dasturchi' });
    expect((await ali.me()).bio).toBe('Dasturchi');

    // Faqat berilgan maydon o'zgaradi; bo'sh bio — o'chiriladi
    expect((await ali.updateProfile({ displayName: `${base} 2` })).bio).toBe('Dasturchi');
    expect((await ali.updateProfile({ bio: '' })).bio).toBeNull();
    expect((await ali.me()).displayName).toBe(`${base} 2`);

    // Boshqa foydalanuvchi qidiruvda yangi ismni ko'radi, email yo'q
    const [found] = await vali.searchUsers(`${base} 2`);
    expect(found).toMatchObject({ id: user.ali.id, displayName: `${base} 2`, bio: null });
    expect(found).not.toHaveProperty('email');

    // Validatsiya
    await expect(ali.updateProfile({ displayName: '   ' })).rejects.toMatchObject({ status: 400 });
    await expect(ali.updateProfile({ displayName: 'x'.repeat(65) })).rejects.toMatchObject({ status: 400 });
    await expect(ali.updateProfile({ bio: 'x'.repeat(201) })).rejects.toMatchObject({ status: 400 });
    await expect(ali.updateProfile({})).rejects.toMatchObject({ status: 400 });
    expect((await ali.me()).displayName).toBe(`${base} 2`);

    // Tokensiz — 401
    await expect(mkApi().updateProfile({ displayName: 'Begona' })).rejects.toMatchObject({ status: 401 });
    await ali.updateProfile({ displayName: user.ali.displayName });
  });

  it('kanal: faqat owner/admin yozadi, ochiq kanal qidiruvi, obuna/chiqish', async () => {
    const { ali, vali, gani } = api;
    const pub = await ali.createChannel({ title: `Yangiliklar ${stamp}`, description: 'ochiq', isPublic: true });
    const priv = await ali.createChannel({ title: `Maxfiy ${stamp}`, isPublic: false });
    expect(pub).toMatchObject({ type: 'channel', isPublic: true, memberCount: 1 });

    // Qidiruv: ochiq topiladi, yopiq — yo'q; isMember to'g'ri
    const found = await vali.searchPublicChannels(`yangiliklar ${stamp}`);
    expect(found).toEqual([{ id: pub.id, title: pub.title, description: 'ochiq', memberCount: 1, isMember: false }]);
    expect(await vali.searchPublicChannels(`maxfiy ${stamp}`)).toEqual([]);
    expect((await ali.searchPublicChannels(`yangiliklar ${stamp}`))[0].isMember).toBe(true);
    await expect(vali.joinChannel(priv.id)).rejects.toMatchObject({ status: 404 }); // yopiq kanal oshkor bo'lmaydi
    await expect(vali.getChat(pub.id)).rejects.toMatchObject({ status: 404 }); // obuna bo'lmaguncha ko'rmaydi

    // Obuna: egasi `chat:member` oladi; qayta obuna idempotent
    const owner = next(ws.ali, 'chat:member', (e) => e.userId === user.vali.id && e.action === 'added');
    const joined = await vali.joinChannel(pub.id);
    expect(joined).toMatchObject({ id: pub.id, memberCount: 2 });
    expect((await owner).memberCount).toBe(2);
    expect((await vali.joinChannel(pub.id)).memberCount).toBe(2);
    await gani.joinChannel(pub.id);

    // Obunachi uchun a'zolar ro'yxati: faqat owner/admin + o'zi (gani ko'rinmaydi)
    const asVali = await vali.getChat(pub.id);
    expect(asVali.memberCount).toBe(3);
    expect(asVali.members.map((x) => x.user.id).sort()).toEqual([user.ali.id, user.vali.id].sort());

    // Obunachi yozolmaydi (REST, WS, yuklash), ega yozadi va hamma oladi
    await expect(vali.sendMessage(pub.id, { content: 'salom' })).rejects.toMatchObject({ status: 403 });
    await expect(ws.vali.sendMessage({ chatId: pub.id, content: 'salom' })).rejects.toThrow('Kanalda faqat adminlar yozishi mumkin');
    await expect(
      vali.createUpload({ chatId: pub.id, kind: 'image', name: 'a.png', mime: 'image/png', size: 10 }),
    ).rejects.toMatchObject({ status: 403 });
    const valiGets = next(ws.vali, 'message:new');
    const ganiGets = next(ws.gani, 'message:new');
    const post = await ws.ali.sendMessage({ chatId: pub.id, content: 'Birinchi post' });
    expect((await valiGets).message.id).toBe(post.id);
    expect((await ganiGets).message.id).toBe(post.id);

    // Kanalda "yozmoqda" tarqatilmaydi
    const quiet = never(ws.vali, 'typing');
    ws.ali.setTyping(pub.id, true);
    await quiet;

    // Admin tayinlangach yoza oladi; olib tashlansa — yana yo'q
    await ali.setMemberRole(pub.id, user.vali.id, 'admin');
    expect((await ws.vali.sendMessage({ chatId: pub.id, content: 'admin posti' })).content).toBe('admin posti');
    expect((await gani.getChat(pub.id)).members.map((x) => x.user.id).sort()).toEqual([user.ali.id, user.gani.id, user.vali.id].sort());
    await ali.setMemberRole(pub.id, user.vali.id, 'member');
    await expect(vali.sendMessage(pub.id, { content: 'yana' })).rejects.toMatchObject({ status: 403 });
    // Oddiy a'zo o'z xabarini ham, boshqasinikini ham o'chira olmaydi
    await expect(gani.deleteMessage(pub.id, post.id)).rejects.toMatchObject({ status: 403 });

    // Obunadan chiqish; ega — chiqa olmaydi
    await gani.leaveChat(pub.id);
    await expect(gani.getChat(pub.id)).rejects.toMatchObject({ status: 404 });
    expect((await ali.getChat(pub.id)).memberCount).toBe(2);
    await expect(ali.leaveChat(pub.id)).rejects.toMatchObject({ status: 403 });

    // Ochiqlikni yopish: qidiruvdan chiqadi
    await ali.updateChat(pub.id, { isPublic: false });
    expect(await gani.searchPublicChannels(`yangiliklar ${stamp}`)).toEqual([]);
    await expect(gani.joinChannel(pub.id)).rejects.toMatchObject({ status: 404 });
  });

  it('xabarni tahrirlash va o\'chirish (soft-delete) + WS', async () => {
    const { ali, vali } = api;
    const chat = await ali.createDirectChat(user.vali.id);
    const sent = await ws.ali.sendMessage({ chatId: chat.id, content: 'xato matn' });
    expect(sent.editedAt).toBeNull();

    // Tahrirlash: faqat muallif; boshqa tomon `message:updated` oladi
    const upd = next(ws.vali, 'message:updated');
    const edited = await ws.ali.editMessage(chat.id, sent.id, '  to\'g\'ri matn ');
    expect(edited).toMatchObject({ id: sent.id, content: 'to\'g\'ri matn', editedAt: expect.any(String) });
    expect((await upd).message).toEqual(edited);
    await expect(vali.editMessage(chat.id, sent.id, 'hack')).rejects.toMatchObject({ status: 403 });
    await expect(ali.editMessage(chat.id, sent.id, '   ')).rejects.toMatchObject({ status: 400 });
    expect((await vali.listMessages(chat.id)).items[0]).toMatchObject({ content: 'to\'g\'ri matn', editedAt: edited.editedAt });
    const viaRest = await ali.editMessage(chat.id, sent.id, 'REST orqali');
    expect(viaRest.content).toBe('REST orqali');

    // 1:1 da birovning xabarini o'chirib bo'lmaydi
    await expect(vali.deleteMessage(chat.id, sent.id)).rejects.toMatchObject({ status: 403 });
    expect((await vali.getChat(chat.id)).unreadCount).toBe(1);

    // O'chirish: ikkala tomon `message:deleted` oladi, tarix/oxirgi xabar/o'qilmaganlardan chiqadi
    const gone = next(ws.vali, 'message:deleted');
    const res = await ws.ali.deleteMessage(chat.id, sent.id);
    expect(await gone).toEqual({ chatId: chat.id, messageId: sent.id, deletedAt: res.deletedAt });
    expect((await vali.listMessages(chat.id)).items).toEqual([]);
    const after = await vali.getChat(chat.id);
    expect(after).toMatchObject({ unreadCount: 0, lastMessage: null });
    // Qator bazada qoladi (soft-delete), matni tozalangan
    const row = await prisma.message.findUniqueOrThrow({ where: { id: sent.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.content).toBe('');
    await expect(ali.editMessage(chat.id, sent.id, 'qayta')).rejects.toMatchObject({ status: 404 });
    await expect(ali.deleteMessage(chat.id, sent.id)).rejects.toMatchObject({ status: 404 });
    // Boshqa chatning xabari bilan aralashtirib bo'lmaydi
    const other = await ali.createDirectChat(user.gani.id);
    const m2 = await ali.sendMessage(other.id, { content: 'boshqa' });
    await expect(ali.deleteMessage(chat.id, m2.id)).rejects.toMatchObject({ status: 404 });
  });

  it('javob (replyTo): shu chat xabariga — WS va REST, boshqa chat/o\'chirilgan/tizim xabariga — 400, o\'chirilsa "deleted"', async () => {
    const { ali, vali } = api;
    const chat = await ali.createDirectChat(user.hasan.id);
    const original = await ws.ali.sendMessage({ chatId: chat.id, content: 'Ertaga uchrashamizmi? 😀'.repeat(20) });

    // WS orqali javob; ikkinchi tomon `message:new` da replyTo bilan oladi
    const arrived = next(ws.hasan, 'message:new', (p) => p.message.chatId === chat.id);
    const reply = await ws.hasan.sendMessage({ chatId: chat.id, content: 'Ha', replyToId: original.id });
    expect(reply.replyTo).toMatchObject({ id: original.id, senderId: user.ali.id, deleted: false, kind: null });
    // Uzun matn qisqartiriladi (emoji o'rtasidan kesilmaydi)
    expect(reply.replyTo?.content.length).toBeLessThanOrEqual(200);
    expect(original.content.startsWith(reply.replyTo?.content ?? 'x')).toBe(true);
    expect((await arrived).message.replyTo?.id).toBe(original.id);
    // Tarix va ro'yxatda ham
    const page = await ali.listMessages(chat.id);
    expect(page.items.find((m) => m.id === reply.id)?.replyTo?.id).toBe(original.id);
    expect(page.items.find((m) => m.id === original.id)?.replyTo).toBeNull();
    expect((await ali.getChat(chat.id)).lastMessage?.replyTo?.id).toBe(original.id);

    // REST zaxira ham qo'llaydi
    const viaRest = await api.hasan.sendMessage(chat.id, { content: 'REST javob', replyToId: original.id });
    expect(viaRest.replyTo?.id).toBe(original.id);
    // Tahrirlangandan keyin ham javob saqlanadi
    expect((await ws.hasan.editMessage(chat.id, reply.id, 'Ha, albatta')).replyTo?.id).toBe(original.id);

    // Boshqa chat xabariga — 400 (WS'da ack xatosi), mavjud bo'lmagan id — 400
    const otherChat = await ali.createDirectChat(user.vali.id);
    const foreign = await vali.sendMessage(otherChat.id, { content: 'begona' });
    await expect(api.hasan.sendMessage(chat.id, { content: 'x', replyToId: foreign.id })).rejects.toMatchObject({ status: 400 });
    await expect(ws.hasan.sendMessage({ chatId: chat.id, content: 'x', replyToId: foreign.id })).rejects.toThrow(/topilmadi/);
    await expect(api.hasan.sendMessage(chat.id, { content: 'x', replyToId: '00000000-0000-4000-8000-000000000000' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(api.hasan.sendMessage(chat.id, { content: 'x', replyToId: 'not-a-uuid' } as never)).rejects.toMatchObject({ status: 400 });

    // Asl xabar o'chirilsa — javoblarda "deleted", matn ko'rinmaydi; o'chirilgan xabarga yangi javob — 400
    await ali.deleteMessage(chat.id, original.id);
    const replies = (await api.hasan.listMessages(chat.id)).items.filter((m) => m.replyTo);
    expect(replies).toHaveLength(2);
    for (const m of replies) expect(m.replyTo).toEqual({ id: original.id, senderId: user.ali.id, content: '', kind: null, deleted: true });
    await expect(api.hasan.sendMessage(chat.id, { content: 'x', replyToId: original.id })).rejects.toMatchObject({ status: 400 });
  });

  it('media: imzolangan URL → yuklash → rasm xabari; cheklovlar; o\'chirilganda fayl ham o\'chadi', async () => {
    const { ali, vali } = api;
    const chat = await ali.createGroup({ title: `Media ${stamp}`, memberIds: [user.vali.id] });
    const input = { chatId: chat.id, kind: 'image', name: 'rasm.png', mime: 'image/png', size: 2048 } as const;

    // Cheklovlar (yuklashdan oldin)
    await expect(ali.createUpload({ ...input, mime: 'image/svg+xml' })).rejects.toMatchObject({ status: 400 });
    await expect(ali.createUpload({ ...input, kind: 'file', mime: 'text/html' })).rejects.toMatchObject({ status: 400 });
    await expect(ali.createUpload({ ...input, size: 10 * 1024 * 1024 + 1 })).rejects.toMatchObject({ status: 400 });
    await expect(ali.createUpload({ ...input, kind: 'voice', mime: 'audio/webm' })).rejects.toMatchObject({ status: 400 }); // davomiylik yo'q
    const stranger = await api.hasan.createUpload(input).catch((e: { status: number }) => e.status);
    expect(stranger).toBe(404); // a'zo emas

    // To'g'ri oqim
    const up = await ali.createUpload(input);
    expect(up.uploadUrl).toContain('X-Amz-Signature');
    expect(up.headers).toEqual({ 'Content-Type': 'image/png' });
    const signedHeaders = new URL(up.uploadUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signedHeaders).toBe('content-length;content-type;host');

    // Yuklanmagan fayl biriktirilmaydi
    await expect(ali.sendMessage(chat.id, { content: '', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });

    const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: png(2048) });
    expect(put.ok).toBe(true);

    // Boshqa foydalanuvchi bu biriktirmani ishlata olmaydi
    await expect(vali.sendMessage(chat.id, { content: '', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });

    const recv = next(ws.vali, 'message:new');
    const msg = await ws.ali.sendMessage({ chatId: chat.id, content: 'Mana rasm', attachmentId: up.attachmentId, clientId: 'tmp-img' });
    expect(msg).toMatchObject({
      type: 'image',
      content: 'Mana rasm',
      attachment: { id: up.attachmentId, kind: 'image', name: 'rasm.png', mime: 'image/png', size: 2048, durationMs: null },
    });
    expect((await recv).message.attachment?.url).toContain('X-Amz-Signature');
    // Yuklab olish: imzolangan URL'dan aynan shu baytlar
    const dl = await fetch(msg.attachment!.url);
    expect(dl.status).toBe(200);
    expect(Buffer.from(await dl.arrayBuffer())).toEqual(Buffer.alloc(2048, 7));
    // Tarixda ham biriktirma (yangi imzo bilan) bor
    expect((await vali.listMessages(chat.id)).items[0].attachment).toMatchObject({ id: up.attachmentId, size: 2048 });
    expect((await vali.listChats()).find((c) => c.id === chat.id)?.lastMessage?.attachment?.id).toBe(up.attachmentId);

    // Bir biriktirma bir marta ishlatiladi
    await expect(ali.sendMessage(chat.id, { content: 'qayta', attachmentId: up.attachmentId })).rejects.toMatchObject({ status: 400 });
    // Rasm izohi tahrirlanmaydi
    await expect(ali.editMessage(chat.id, msg.id, 'yangi izoh')).rejects.toMatchObject({ status: 400 });

    // Saqlashga e'lon qilinganidan boshqa hajm yuklangan → rad (va obyekt o'chiriladi)
    const liar = await ali.createUpload(input);
    // Soxta server imzoni tekshirmaydi (obyekt saqlanadi → API HEAD'da "mos emas" deydi);
    // haqiqiy MinIO esa imzodagi Content-Length'ga mos kelmagan yuklashni o'zi rad etadi.
    const wrong = await fetch(liar.uploadUrl, { method: 'PUT', headers: liar.headers, body: png(5000) });
    await expect(ali.sendMessage(chat.id, { content: '', attachmentId: liar.attachmentId })).rejects.toThrow(
      wrong.ok ? /mos emas/ : /yuklanmagan/,
    );
    if (!storage.fake) expect(wrong.ok).toBe(false);

    // Fayl va ovozli xabar (matnsiz)
    const file = await ali.uploadAttachment(
      { chatId: chat.id, kind: 'file', name: 'hisobot.pdf', mime: 'application/pdf', size: 4 },
      new Blob(['%PDF'], { type: 'application/pdf' }),
    );
    const filemsg = await ali.sendMessage(chat.id, { content: '', attachmentId: file.attachmentId });
    expect(filemsg).toMatchObject({ type: 'file', content: '', attachment: { name: 'hisobot.pdf' } });
    const voice = await ali.uploadAttachment(
      { chatId: chat.id, kind: 'voice', name: 'ovoz.webm', mime: 'audio/webm;codecs=opus', size: 3, durationMs: 4200 },
      new Blob(['abc'], { type: 'audio/webm' }),
    );
    const voicemsg = await ws.ali.sendMessage({ chatId: chat.id, content: '', attachmentId: voice.attachmentId });
    expect(voicemsg).toMatchObject({ type: 'voice', attachment: { kind: 'voice', mime: 'audio/webm', durationMs: 4200 } });
    // Faylning yuklab olish havolasi "attachment" sifatida beriladi
    expect(new URL(filemsg.attachment!.url).searchParams.get('response-content-disposition')).toContain('attachment');
    expect(new URL(msg.attachment!.url).searchParams.get('response-content-disposition')).toContain('inline');

    // Xabar o'chirilganda obyekt ham o'chadi
    const key = (await prisma.attachment.findUniqueOrThrow({ where: { id: up.attachmentId } })).key;
    await vali.deleteMessage(chat.id, msg.id).then(
      () => { throw new Error('oddiy a\'zo birovning xabarini o\'chirmasligi kerak'); },
      (e: { status: number }) => expect(e.status).toBe(403),
    );
    await ali.deleteMessage(chat.id, msg.id);
    if (storage.fake) expect(storage.fake.objects.has(`/${process.env.S3_BUCKET ?? 'suhbat'}/${key}`)).toBe(false);
    else expect((await fetch(msg.attachment!.url)).status).toBe(404);
  });

  it('socket: access token muddati tugaganda uziladi, mijoz yangi token bilan qayta ulanadi', async () => {
    const { hasan } = api;
    const jwt = app.get(JwtService);
    const shortLived = await jwt.signAsync({ sub: user.hasan.id }, { expiresIn: '2s' });
    let token = shortLived;
    let refreshed = 0;
    const client = createSocketClient({
      url,
      getAccessToken:     async () => token,
      refreshAccessToken: async () => { refreshed++; token = (await hasan.refreshAccessToken())!; return token; },
    });
    sockets.push(client);
    let connects = 0;
    const drops: string[] = [];
    client.onConnectionChange((up) => { if (up) connects++; else drops.push('down'); });
    const t0 = Date.now();
    client.connect();
    await waitConnected(client);
    expect(connects).toBe(1);

    // JWT `exp` butun soniya: '2s' token 1–2 soniyada tugaydi. Server uzadi, mijoz refresh qilib qayta ulanadi
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('qayta ulanmadi')), 6000);
      const off = client.onConnectionChange((up) => { if (up && connects >= 2) { clearTimeout(timer); off(); resolve(); } });
    });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(500); // darhol emas — token tugashini kutgan
    expect(drops).toHaveLength(1);
    expect(refreshed).toBe(1);

    // Yangi ulanish ishlaydi
    const chat = await hasan.createDirectChat(user.ali.id);
    expect((await client.sendMessage({ chatId: chat.id, content: 'yangi token bilan' })).content).toBe('yangi token bilan');

    // Muddati tugagan token bilan ulanish umuman o'tmaydi
    const expired = await jwt.signAsync({ sub: user.hasan.id }, { expiresIn: '1s' });
    await new Promise((r) => setTimeout(r, 1200));
    const res = await fetch(`${url}/chats`, { headers: { Authorization: `Bearer ${expired}` } });
    expect(res.status).toBe(401); // REST tomonda JwtAuthGuard muddatni tekshiradi
  });
});
