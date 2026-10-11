import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChatSummary, Message, MessagePage, MessagesQuery } from '@suhbat/core';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor, toMessage, toSummary } from './chat.mappers';

const summaryInclude = {
  members:  { include: { user: true }, orderBy: { joinedAt: 'asc' } },
  messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
} satisfies Prisma.ChatInclude;

export const directKeyOf = (a: string, b: string) => [a, b].sort().join(':');

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 1:1 chat: bor bo'lsa o'shani, yo'q bo'lsa yangisini qaytaradi. */
  async createDirect(me: string, otherId: string): Promise<ChatSummary> {
    if (me === otherId) throw new BadRequestException('O\'zingiz bilan chat ochib bo\'lmaydi');
    const other = await this.prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
    if (!other) throw new NotFoundException('Foydalanuvchi topilmadi');

    const directKey = directKeyOf(me, otherId);
    let chat = await this.prisma.chat.findUnique({ where: { directKey }, select: { id: true } });
    if (!chat) {
      try {
        chat = await this.prisma.chat.create({
          data: {
            type: 'direct',
            directKey,
            members: { create: [{ userId: me }, { userId: otherId }] },
          },
          select: { id: true },
        });
      } catch (e) {
        // Ikkala tomon bir vaqtda ochsa — unique(direct_key) ikkinchisini to'xtatadi.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        chat = await this.prisma.chat.findUniqueOrThrow({ where: { directKey }, select: { id: true } });
      }
    }
    return this.getSummary(chat.id, me);
  }

  async list(me: string): Promise<ChatSummary[]> {
    const [chats, unread] = await Promise.all([
      this.prisma.chat.findMany({
        where:   { members: { some: { userId: me } } },
        include: summaryInclude,
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
      this.unreadCounts(me),
    ]);
    return chats.map((c) => toSummary(c, unread.get(c.id) ?? 0));
  }

  async getSummary(chatId: string, me: string): Promise<ChatSummary> {
    const chat = await this.prisma.chat.findFirst({
      where:   { id: chatId, members: { some: { userId: me } } },
      include: summaryInclude,
    });
    if (!chat) throw new NotFoundException('Chat topilmadi');
    const unread = await this.unreadCounts(me, chatId);
    return toSummary(chat, unread.get(chatId) ?? 0);
  }

  /** A'zo bo'lmasa — 404 (chat borligini oshkor qilmaymiz). A'zolar id'larini qaytaradi. */
  async memberIds(chatId: string, me: string): Promise<string[]> {
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    const ids = members.map((m) => m.userId);
    if (!ids.includes(me)) throw new NotFoundException('Chat topilmadi');
    return ids;
  }

  async listMessages(chatId: string, me: string, query: MessagesQuery): Promise<MessagePage> {
    await this.memberIds(chatId, me);
    let cursorWhere: Prisma.MessageWhereInput = {};
    if (query.before) {
      const c = decodeCursor(query.before);
      if (!c) throw new BadRequestException('Kursor noto\'g\'ri');
      cursorWhere = {
        OR: [
          { createdAt: { lt: c.createdAt } },
          { createdAt: c.createdAt, id: { lt: c.id } },
        ],
      };
    }
    const rows = await this.prisma.message.findMany({
      where:   { chatId, ...cursorWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take:    query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items:      page.reverse().map(toMessage),
      nextCursor: hasMore ? encodeCursor(page[0]) : null,
    };
  }

  async sendMessage(chatId: string, me: string, content: string): Promise<{ message: Message; memberIds: string[] }> {
    const memberIds = await this.memberIds(chatId, me);
    const row = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({ data: { chatId, senderId: me, content } });
      await tx.chat.update({ where: { id: chatId }, data: { lastMessageAt: message.createdAt } });
      // O'z xabari — yuboruvchi uchun o'qilgan.
      await tx.chatMember.update({
        where: { chatId_userId: { chatId, userId: me } },
        data:  { lastReadAt: message.createdAt },
      });
      return message;
    });
    return { message: toMessage(row), memberIds };
  }

  /** `messageId` gacha o'qildi. `lastReadAt` faqat oldinga siljiydi. */
  async markRead(chatId: string, me: string, messageId: string): Promise<{ lastReadAt: string; memberIds: string[] }> {
    const memberIds = await this.memberIds(chatId, me);
    const message = await this.prisma.message.findFirst({
      where:  { id: messageId, chatId },
      select: { createdAt: true },
    });
    if (!message) throw new NotFoundException('Xabar topilmadi');
    await this.prisma.chatMember.updateMany({
      where: {
        chatId,
        userId: me,
        OR:     [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }],
      },
      data: { lastReadAt: message.createdAt },
    });
    const member = await this.prisma.chatMember.findUniqueOrThrow({
      where:  { chatId_userId: { chatId, userId: me } },
      select: { lastReadAt: true },
    });
    return { lastReadAt: (member.lastReadAt ?? message.createdAt).toISOString(), memberIds };
  }

  /** Kamida bitta umumiy chati bor foydalanuvchilar (presence kimga yuborilishi uchun). */
  async contactIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.chatMember.findMany({
      where:    { chat: { members: { some: { userId } } }, userId: { not: userId } },
      select:   { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  async lastSeenOf(userIds: string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.user.findMany({
      where:  { id: { in: userIds }, lastSeenAt: { not: null } },
      select: { id: true, lastSeenAt: true },
    });
    return new Map(rows.map((r) => [r.id, r.lastSeenAt!.toISOString()]));
  }

  async touchLastSeen(userId: string, at: Date): Promise<void> {
    await this.prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt: at } });
  }

  private async unreadCounts(me: string, chatId?: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ chat_id: string; unread: number }[]>`
      SELECT cm.chat_id, COUNT(m.id)::int AS unread
      FROM chat_members cm
      JOIN messages m
        ON m.chat_id = cm.chat_id
       AND m.sender_id <> cm.user_id
       AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
      WHERE cm.user_id = ${me}::uuid
        ${chatId ? Prisma.sql`AND cm.chat_id = ${chatId}::uuid` : Prisma.empty}
      GROUP BY cm.chat_id`;
    return new Map(rows.map((r) => [r.chat_id, r.unread]));
  }
}
