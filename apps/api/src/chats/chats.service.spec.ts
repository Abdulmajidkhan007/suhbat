import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaService } from '../media/media.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ChatsService } from './chats.service';

const me = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const chatId = '00000000-0000-4000-8000-0000000000c1';

describe('ChatsService', () => {
  const prisma = {
    user:       { findUnique: vi.fn(), count: vi.fn() },
    chat:       { findUnique: vi.fn(), findFirst: vi.fn() },
    chatMember: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    message:    { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  const media = { toDto: vi.fn(), requireReady: vi.fn(), removeObjects: vi.fn() };
  let service: ChatsService;

  /** `access()` uchun: chat turi va a'zolar (id → rol). */
  const chatWith = (type: 'direct' | 'group' | 'channel', members: Record<string, 'owner' | 'admin' | 'member'>) =>
    prisma.chat.findUnique.mockResolvedValue({
      type,
      members: Object.entries(members).map(([userId, role]) => ({ userId, role })),
    });

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ChatsService(prisma as unknown as PrismaService, media as unknown as MediaService);
  });

  it('createDirect: o\'zi bilan — 400, noma\'lum user — 404', async () => {
    await expect(service.createDirect(me, me)).rejects.toBeInstanceOf(BadRequestException);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.createDirect(me, other)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('access: a\'zo bo\'lmasa yoki chat yo\'q bo\'lsa — 404', async () => {
    chatWith('group', { [other]: 'owner' });
    await expect(service.access(chatId, me)).rejects.toBeInstanceOf(NotFoundException);
    prisma.chat.findUnique.mockResolvedValue(null);
    await expect(service.access(chatId, me)).rejects.toBeInstanceOf(NotFoundException);
    chatWith('group', { [other]: 'owner', [me]: 'member' });
    await expect(service.access(chatId, me)).resolves.toEqual({ type: 'group', role: 'member', memberIds: [other, me] });
  });

  it('kanalda oddiy a\'zo yozolmaydi (403), admin yozadi', async () => {
    chatWith('channel', { [other]: 'owner', [me]: 'member' });
    await expect(service.assertCanWrite(chatId, me)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage(chatId, me, 'salom')).rejects.toBeInstanceOf(ForbiddenException);
    chatWith('channel', { [other]: 'owner', [me]: 'admin' });
    await expect(service.assertCanWrite(chatId, me)).resolves.toMatchObject({ role: 'admin' });
  });

  it('updateChat/addMembers: oddiy a\'zo — 403, 1:1 chat — 400', async () => {
    chatWith('group', { [me]: 'member' });
    await expect(service.updateChat(chatId, me, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addMembers(chatId, me, { userIds: [other] })).rejects.toBeInstanceOf(ForbiddenException);
    chatWith('direct', { [me]: 'member', [other]: 'member' });
    await expect(service.updateChat(chatId, me, { title: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateChat: guruhni ochiq qilib bo\'lmaydi', async () => {
    chatWith('group', { [me]: 'owner' });
    await expect(service.updateChat(chatId, me, { isPublic: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addMembers: guruh 200 a\'zodan oshmaydi', async () => {
    const members: Record<string, 'owner' | 'member'> = { [me]: 'owner' };
    for (let i = 0; i < 199; i++) members[`00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`] = 'member';
    chatWith('group', members);
    prisma.user.count.mockResolvedValue(1);
    await expect(service.addMembers(chatId, me, { userIds: [other] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removeMember: egasini ham, admin adminni ham chiqarib bo\'lmaydi; o\'zini — 400', async () => {
    const third = '00000000-0000-4000-8000-000000000003';
    chatWith('group', { [me]: 'admin', [other]: 'owner', [third]: 'admin' });
    await expect(service.removeMember(chatId, me, me)).rejects.toBeInstanceOf(BadRequestException);
    prisma.chatMember.findUnique.mockResolvedValue({ role: 'owner' });
    await expect(service.removeMember(chatId, me, other)).rejects.toBeInstanceOf(ForbiddenException);
    prisma.chatMember.findUnique.mockResolvedValue({ role: 'admin' });
    await expect(service.removeMember(chatId, me, third)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMember.delete).not.toHaveBeenCalled();
  });

  it('leave: ega chiqib keta olmaydi, 1:1 dan chiqib bo\'lmaydi', async () => {
    chatWith('group', { [me]: 'owner' });
    await expect(service.leave(chatId, me)).rejects.toBeInstanceOf(ForbiddenException);
    chatWith('direct', { [me]: 'member', [other]: 'member' });
    await expect(service.leave(chatId, me)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setRole: faqat ega, eganing rolini o\'zgartirib bo\'lmaydi', async () => {
    chatWith('group', { [me]: 'admin', [other]: 'member' });
    await expect(service.setRole(chatId, me, other, 'admin')).rejects.toBeInstanceOf(ForbiddenException);
    chatWith('group', { [me]: 'owner', [other]: 'owner' });
    prisma.chatMember.findUnique.mockResolvedValue({ role: 'owner' });
    await expect(service.setRole(chatId, me, other, 'member')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('join: ochiq kanal topilmasa (yopiq/guruh) — 404', async () => {
    prisma.chat.findFirst.mockResolvedValue(null);
    await expect(service.join(chatId, me)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.chat.findFirst.mock.calls[0][0].where).toMatchObject({ type: 'channel', isPublic: true });
  });

  it('editMessage: faqat o\'z matnli xabari', async () => {
    const msgId = '00000000-0000-4000-8000-0000000000a1';
    chatWith('group', { [me]: 'member', [other]: 'member' });
    prisma.message.findFirst.mockResolvedValue({ id: msgId, senderId: other, type: 'text', attachment: null });
    await expect(service.editMessage(chatId, me, msgId, 'yangi')).rejects.toBeInstanceOf(ForbiddenException);
    prisma.message.findFirst.mockResolvedValue({ id: msgId, senderId: me, type: 'image', attachment: null });
    await expect(service.editMessage(chatId, me, msgId, 'yangi')).rejects.toBeInstanceOf(BadRequestException);
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.editMessage(chatId, me, msgId, 'yangi')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('deleteMessage: begona xabarni faqat guruh/kanal admini o\'chiradi; matn tozalanadi, fayl o\'chadi', async () => {
    const msgId = '00000000-0000-4000-8000-0000000000a1';
    const row = { id: msgId, senderId: other, attachment: { key: 'chats/x/y' } };
    prisma.message.findFirst.mockResolvedValue(row);

    chatWith('group', { [me]: 'member', [other]: 'member' });
    await expect(service.deleteMessage(chatId, me, msgId)).rejects.toBeInstanceOf(ForbiddenException);
    chatWith('direct', { [me]: 'member', [other]: 'member' });
    await expect(service.deleteMessage(chatId, me, msgId)).rejects.toBeInstanceOf(ForbiddenException);

    chatWith('group', { [me]: 'admin', [other]: 'member' });
    const res = await service.deleteMessage(chatId, me, msgId);
    expect(res.memberIds).toEqual([me, other]);
    expect(prisma.message.update.mock.calls[0][0].data).toMatchObject({ content: '', deletedAt: expect.any(Date) });
    expect(media.removeObjects).toHaveBeenCalledWith(['chats/x/y']);
  });

  it('listMessages: limit+1 oladi, xronologik qaytaradi, nextCursor beradi', async () => {
    chatWith('direct', { [me]: 'member' });
    media.toDto.mockResolvedValue(null);
    const row = (i: number) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`, chatId, senderId: me, type: 'text',
      content: `m${i}`, createdAt: new Date(Date.UTC(2026, 9, 11, 10, 0, i)), editedAt: null, attachment: null,
    });
    // DB kamayish tartibida qaytaradi: 3, 2, 1
    prisma.message.findMany.mockResolvedValue([row(3), row(2), row(1)]);

    const page = await service.listMessages(chatId, me, { limit: 2 });

    expect(prisma.message.findMany.mock.calls[0][0].take).toBe(3);
    expect(page.items.map((m) => m.content)).toEqual(['m2', 'm3']);
    expect(page.nextCursor).not.toBeNull();

    // Keyingi sahifa: kursor (createdAt, id) < m2
    prisma.message.findMany.mockResolvedValue([row(1)]);
    const older = await service.listMessages(chatId, me, { limit: 2, before: page.nextCursor! });
    const where = prisma.message.findMany.mock.calls[1][0].where;
    expect(where.OR[0].createdAt.lt).toEqual(row(2).createdAt);
    expect(where.OR[1]).toEqual({ createdAt: row(2).createdAt, id: { lt: row(2).id } });
    expect(prisma.message.findMany.mock.calls[1][0].where.deletedAt).toBeNull();
    expect(older).toEqual({ items: [expect.objectContaining({ content: 'm1' })], nextCursor: null });
  });

  it('listMessages: buzilgan kursor — 400', async () => {
    chatWith('direct', { [me]: 'member' });
    await expect(service.listMessages(chatId, me, { limit: 10, before: 'xyz' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
