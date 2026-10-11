import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ChatsService } from './chats.service';

const me = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const chatId = '00000000-0000-4000-8000-0000000000c1';

describe('ChatsService', () => {
  const prisma = {
    user:       { findUnique: vi.fn() },
    chatMember: { findMany: vi.fn() },
    message:    { findMany: vi.fn() },
  };
  let service: ChatsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ChatsService(prisma as unknown as PrismaService);
  });

  it('createDirect: o\'zi bilan — 400, noma\'lum user — 404', async () => {
    await expect(service.createDirect(me, me)).rejects.toBeInstanceOf(BadRequestException);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.createDirect(me, other)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('memberIds: a\'zo bo\'lmasa — 404', async () => {
    prisma.chatMember.findMany.mockResolvedValue([{ userId: other }]);
    await expect(service.memberIds(chatId, me)).rejects.toBeInstanceOf(NotFoundException);
    prisma.chatMember.findMany.mockResolvedValue([{ userId: other }, { userId: me }]);
    await expect(service.memberIds(chatId, me)).resolves.toEqual([other, me]);
  });

  it('listMessages: limit+1 oladi, xronologik qaytaradi, nextCursor beradi', async () => {
    prisma.chatMember.findMany.mockResolvedValue([{ userId: me }]);
    const row = (i: number) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`, chatId, senderId: me, type: 'text',
      content: `m${i}`, createdAt: new Date(Date.UTC(2026, 9, 11, 10, 0, i)), editedAt: null,
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
    expect(older).toEqual({ items: [expect.objectContaining({ content: 'm1' })], nextCursor: null });
  });

  it('listMessages: buzilgan kursor — 400', async () => {
    prisma.chatMember.findMany.mockResolvedValue([{ userId: me }]);
    await expect(service.listMessages(chatId, me, { limit: 10, before: 'xyz' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
