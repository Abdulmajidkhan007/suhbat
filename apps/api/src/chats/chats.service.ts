import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MAX_GROUP_MEMBERS, canManage, canModerateMessages, canRemove, canWrite } from '@suhbat/core';
import type {
  AddMembersInput,
  ChatRole,
  ChatSummary,
  ChatType,
  CreateChannelInput,
  CreateGroupInput,
  Message,
  MessagePage,
  MessagesQuery,
  PublicChannel,
  PublicChannelsQuery,
  UpdateChatInput,
  WsChatMember,
  WsChatMemberAction,
  WsChatUpdated,
} from '@suhbat/core';
import { Prisma } from '../generated/prisma/client';
import type { Attachment as AttachmentRow, Message as MessageRow } from '../generated/prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor, toChatMember, toMessage, toSummary } from './chat.mappers';

const summaryInclude = (me: string) =>
  ({
    // Kanalda minglab obunachi bo'lishi mumkin: faqat owner/adminlar va o'zim.
    members: {
      where: {
        OR: [{ role: { in: ['owner', 'admin'] } }, { userId: me }, { chat: { type: { not: 'channel' } } }],
      },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    },
    messages: {
      where:   { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take:    1,
      include: { attachment: true },
    },
    _count: { select: { members: true } },
  }) satisfies Prisma.ChatInclude;

export const directKeyOf = (a: string, b: string) => [a, b].sort().join(':');

export interface ChatAccess {
  type:      ChatType;
  role:      ChatRole;
  memberIds: string[];
}

/** Bitta `chat:member` voqeasi va uni kimlarga yuborish. */
export interface MemberChange {
  event:        WsChatMember;
  recipientIds: string[];
}

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // --- Chat yaratish ---

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

  /** Yaratuvchi — `owner`. `added` — yaratuvchidan boshqa a'zolar (ularga xabar berish uchun). */
  async createGroup(me: string, input: CreateGroupInput): Promise<{ chat: ChatSummary; added: string[] }> {
    const added = [...new Set(input.memberIds)].filter((id) => id !== me);
    await this.requireUsers(added);
    const chat = await this.prisma.chat.create({
      data: {
        type:        'group',
        title:       input.title,
        description: input.description || null,
        members:     { create: [{ userId: me, role: 'owner' }, ...added.map((userId) => ({ userId }))] },
      },
      select: { id: true },
    });
    return { chat: await this.getSummary(chat.id, me), added };
  }

  async createChannel(me: string, input: CreateChannelInput): Promise<ChatSummary> {
    const chat = await this.prisma.chat.create({
      data: {
        type:        'channel',
        title:       input.title,
        description: input.description || null,
        isPublic:    input.isPublic,
        members:     { create: [{ userId: me, role: 'owner' }] },
      },
      select: { id: true },
    });
    return this.getSummary(chat.id, me);
  }

  // --- O'qish ---

  async list(me: string): Promise<ChatSummary[]> {
    const [chats, unread] = await Promise.all([
      this.prisma.chat.findMany({
        where:   { members: { some: { userId: me } } },
        include: summaryInclude(me),
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
      this.unreadCounts(me),
    ]);
    return Promise.all(
      chats.map(async (c) => toSummary(c, unread.get(c.id) ?? 0, await this.presentLast(c.messages[0]))),
    );
  }

  async getSummary(chatId: string, me: string): Promise<ChatSummary> {
    const chat = await this.prisma.chat.findFirst({
      where:   { id: chatId, members: { some: { userId: me } } },
      include: summaryInclude(me),
    });
    if (!chat) throw new NotFoundException('Chat topilmadi');
    const unread = await this.unreadCounts(me, chatId);
    return toSummary(chat, unread.get(chatId) ?? 0, await this.presentLast(chat.messages[0]));
  }

  /** Ochiq kanallar: nom bo'yicha, obunachilar soni kamayish tartibida. */
  async searchPublicChannels(me: string, query: PublicChannelsQuery): Promise<PublicChannel[]> {
    const channels = await this.prisma.chat.findMany({
      where: {
        type:     'channel',
        isPublic: true,
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id:          true,
        title:       true,
        description: true,
        _count:      { select: { members: true } },
        members:     { where: { userId: me }, select: { userId: true } },
      },
      orderBy: [{ members: { _count: 'desc' } }, { title: 'asc' }, { id: 'asc' }],
      take:    query.limit,
    });
    return channels.map((c) => ({
      id:          c.id,
      title:       c.title ?? '',
      description: c.description,
      memberCount: c._count.members,
      isMember:    c.members.length > 0,
    }));
  }

  // --- A'zolik tekshiruvi ---

  /** A'zo bo'lmasa — 404 (chat borligini oshkor qilmaymiz). */
  async access(chatId: string, me: string): Promise<ChatAccess> {
    const chat = await this.prisma.chat.findUnique({
      where:  { id: chatId },
      select: { type: true, members: { select: { userId: true, role: true } } },
    });
    const mine = chat?.members.find((m) => m.userId === me);
    if (!chat || !mine) throw new NotFoundException('Chat topilmadi');
    return { type: chat.type, role: mine.role, memberIds: chat.members.map((m) => m.userId) };
  }

  async memberIds(chatId: string, me: string): Promise<string[]> {
    return (await this.access(chatId, me)).memberIds;
  }

  /**
   * Yozish huquqi (kanalda faqat owner/admin; 1:1 da — hech kim bloklamagan bo'lsa).
   * Yuklash URL'i berishdan oldin ham tekshiriladi.
   */
  async assertCanWrite(chatId: string, me: string): Promise<ChatAccess> {
    const access = await this.access(chatId, me);
    if (!canWrite(access.type, access.role)) throw new ForbiddenException('Kanalda faqat adminlar yozishi mumkin');
    if (access.type === 'direct') {
      const other = access.memberIds.find((id) => id !== me);
      if (other && (await this.isBlockedBetween(me, other))) {
        throw new ForbiddenException('Bu foydalanuvchi bilan yozishib bo\'lmaydi (bloklangan)');
      }
    }
    return access;
  }

  /** Ikki tomondan biri ikkinchisini bloklaganmi. */
  private async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const n = await this.prisma.userBlock.count({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    });
    return n > 0;
  }

  // --- Sozlamalar ---

  async updateChat(
    chatId: string,
    me: string,
    input: UpdateChatInput,
  ): Promise<{ event: WsChatUpdated; recipientIds: string[] }> {
    const access = await this.requireManage(chatId, me);
    if (input.isPublic !== undefined && access.type !== 'channel') {
      throw new BadRequestException('Faqat kanal ochiq bo\'la oladi');
    }
    const chat = await this.prisma.chat.update({
      where: { id: chatId },
      data:  {
        title:       input.title,
        description: input.description === undefined ? undefined : input.description || null,
        isPublic:    input.isPublic,
      },
    });
    return {
      event: {
        chatId,
        title:       chat.title,
        description: chat.description,
        isPublic:    chat.isPublic,
        updatedAt:   chat.updatedAt.toISOString(),
      },
      recipientIds: access.memberIds,
    };
  }

  /** Faqat egasi. Guruh/kanal a'zolari uchun `chat:deleted`; biriktirmalar saqlashdan ham o'chadi. */
  async deleteChat(chatId: string, me: string): Promise<string[]> {
    const access = await this.access(chatId, me);
    if (access.type === 'direct') throw new BadRequestException('1:1 chatni o\'chirib bo\'lmaydi');
    if (access.role !== 'owner') throw new ForbiddenException('Faqat egasi chatni o\'chira oladi');
    const files = await this.prisma.attachment.findMany({ where: { chatId }, select: { key: true } });
    await this.prisma.chat.delete({ where: { id: chatId } });
    await this.media.removeObjects(files.map((f) => f.key));
    return access.memberIds;
  }

  // --- A'zolar ---

  /** Mavjud a'zolar e'tiborsiz; faqat yangilari uchun voqea qaytadi. */
  async addMembers(chatId: string, me: string, input: AddMembersInput): Promise<{ chat: ChatSummary; changes: MemberChange[] }> {
    const access = await this.requireManage(chatId, me);
    const fresh = [...new Set(input.userIds)].filter((id) => !access.memberIds.includes(id));
    await this.requireUsers(fresh);
    if (access.type === 'group' && access.memberIds.length + fresh.length > MAX_GROUP_MEMBERS) {
      throw new BadRequestException(`Guruhda ${MAX_GROUP_MEMBERS} tadan ortiq a'zo bo'lmaydi`);
    }
    if (fresh.length > 0) {
      await this.prisma.chatMember.createMany({
        data:           fresh.map((userId) => ({ chatId, userId })),
        skipDuplicates: true,
      });
    }
    const changes = await Promise.all(fresh.map((id) => this.memberChange(chatId, access.type, id, 'added')));
    return { chat: await this.getSummary(chatId, me), changes };
  }

  async removeMember(chatId: string, me: string, userId: string): Promise<MemberChange> {
    const access = await this.requireManage(chatId, me);
    if (userId === me) throw new BadRequestException('O\'zingizni chiqarish uchun "chiqish" dan foydalaning');
    const target = await this.prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
    if (!target) throw new NotFoundException('A\'zo topilmadi');
    if (!canRemove(access.role, target.role)) throw new ForbiddenException('Bu a\'zoni chiqarish huquqingiz yo\'q');
    await this.prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId } } });
    return this.memberChange(chatId, access.type, userId, 'removed');
  }

  /** Egasidan boshqa hamma chiqib keta oladi; ega chatni o'chirishi kerak. */
  async leave(chatId: string, me: string): Promise<MemberChange> {
    const access = await this.access(chatId, me);
    if (access.type === 'direct') throw new BadRequestException('1:1 chatdan chiqib bo\'lmaydi');
    if (access.role === 'owner') throw new ForbiddenException('Ega chatdan chiqib keta olmaydi — chatni o\'chiring');
    await this.prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId: me } } });
    return this.memberChange(chatId, access.type, me, 'removed');
  }

  /** Faqat ochiq kanalga; yopiq kanal/guruh/direct uchun 404 (mavjudligi oshkor bo'lmaydi). */
  async join(chatId: string, me: string): Promise<{ chat: ChatSummary; change: MemberChange | null }> {
    const chat = await this.prisma.chat.findFirst({
      where:  { id: chatId, type: 'channel', isPublic: true },
      select: { id: true },
    });
    if (!chat) throw new NotFoundException('Kanal topilmadi');
    const created = await this.prisma.chatMember.createMany({
      data:           [{ chatId, userId: me }],
      skipDuplicates: true,
    });
    const change = created.count > 0 ? await this.memberChange(chatId, 'channel', me, 'added') : null;
    return { chat: await this.getSummary(chatId, me), change };
  }

  /** Faqat egasi: `admin` ↔ `member`. Egalik o'tkazilmaydi. */
  async setRole(chatId: string, me: string, userId: string, role: 'admin' | 'member'): Promise<MemberChange> {
    const access = await this.access(chatId, me);
    if (access.type === 'direct') throw new BadRequestException('1:1 chatda rollar yo\'q');
    if (access.role !== 'owner') throw new ForbiddenException('Rollarni faqat egasi o\'zgartiradi');
    const target = await this.prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
    if (!target) throw new NotFoundException('A\'zo topilmadi');
    if (target.role === 'owner') throw new BadRequestException('Egasining rolini o\'zgartirib bo\'lmaydi');
    await this.prisma.chatMember.update({ where: { chatId_userId: { chatId, userId } }, data: { role } });
    return this.memberChange(chatId, access.type, userId, 'role');
  }

  // --- Xabarlar ---

  async listMessages(chatId: string, me: string, query: MessagesQuery): Promise<MessagePage> {
    await this.access(chatId, me);
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
      where:   { chatId, deletedAt: null, ...cursorWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take:    query.limit + 1,
      include: { attachment: true },
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items:      await Promise.all(page.reverse().map((r) => this.present(r, r.attachment))),
      nextCursor: hasMore ? encodeCursor(page[0]) : null,
    };
  }

  async sendMessage(
    chatId: string,
    me: string,
    content: string,
    attachmentId?: string,
  ): Promise<{ message: Message; memberIds: string[] }> {
    const access = await this.assertCanWrite(chatId, me);
    const attachment = attachmentId ? await this.media.requireReady(attachmentId, me, chatId) : null;
    const row = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { chatId, senderId: me, content, type: attachment?.kind ?? 'text' },
      });
      if (attachment) {
        // Bir biriktirma ikki xabarga biriktirilmasligi uchun shartli yangilash.
        const claimed = await tx.attachment.updateMany({
          where: { id: attachment.id, messageId: null },
          data:  { messageId: message.id },
        });
        if (claimed.count !== 1) throw new BadRequestException('Biriktirma allaqachon ishlatilgan');
      }
      await tx.chat.update({ where: { id: chatId }, data: { lastMessageAt: message.createdAt } });
      // O'z xabari — yuboruvchi uchun o'qilgan.
      await tx.chatMember.update({
        where: { chatId_userId: { chatId, userId: me } },
        data:  { lastReadAt: message.createdAt },
      });
      return message;
    });
    return { message: await this.present(row, attachment), memberIds: access.memberIds };
  }

  /** Faqat o'z matnli xabari (kanalda — yozish huquqi saqlanib qolgan bo'lsa). */
  async editMessage(
    chatId: string,
    me: string,
    messageId: string,
    content: string,
  ): Promise<{ message: Message; memberIds: string[] }> {
    const access = await this.access(chatId, me);
    const found = await this.findLiveMessage(chatId, messageId);
    if (found.senderId !== me) throw new ForbiddenException('Faqat o\'z xabaringizni tahrirlash mumkin');
    if (found.type !== 'text') throw new BadRequestException('Faqat matnli xabar tahrirlanadi');
    if (!canWrite(access.type, access.role)) throw new ForbiddenException('Kanalda faqat adminlar yozishi mumkin');
    const row = await this.prisma.message.update({
      where: { id: messageId },
      data:  { content, editedAt: new Date() },
    });
    return { message: await this.present(row, null), memberIds: access.memberIds };
  }

  /**
   * Soft-delete: qator qoladi (`deletedAt`), matn tozalanadi, fayl saqlashdan
   * o'chiriladi. O'zinikini hamma o'chira oladi; birovniki — guruh/kanal owner/admini.
   */
  async deleteMessage(
    chatId: string,
    me: string,
    messageId: string,
  ): Promise<{ deletedAt: string; memberIds: string[] }> {
    const access = await this.access(chatId, me);
    const found = await this.findLiveMessage(chatId, messageId);
    if (found.senderId !== me && !canModerateMessages(access.type, access.role)) {
      throw new ForbiddenException('Bu xabarni o\'chirish huquqingiz yo\'q');
    }
    const deletedAt = new Date();
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt, content: '' } });
    if (found.attachment) await this.media.removeObjects([found.attachment.key]);
    return { deletedAt: deletedAt.toISOString(), memberIds: access.memberIds };
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

  // --- Presence ---

  /** Kamida bitta umumiy chati bor foydalanuvchilar (presence kimga yuborilishi uchun). Kanallar hisobga olinmaydi. */
  async contactIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.chatMember.findMany({
      where: {
        userId: { not: userId },
        chat:   { type: { not: 'channel' }, members: { some: { userId } } },
      },
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

  // --- Ichki yordamchilar ---

  private async requireManage(chatId: string, me: string): Promise<ChatAccess> {
    const access = await this.access(chatId, me);
    if (access.type === 'direct') throw new BadRequestException('Bu amal 1:1 chatda mavjud emas');
    if (!canManage(access.type, access.role)) throw new ForbiddenException('Buning uchun admin yoki ega bo\'lish kerak');
    return access;
  }

  private async requireUsers(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const count = await this.prisma.user.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new NotFoundException('Foydalanuvchi topilmadi');
  }

  private async findLiveMessage(chatId: string, messageId: string) {
    const found = await this.prisma.message.findFirst({
      where:   { id: messageId, chatId, deletedAt: null },
      include: { attachment: true },
    });
    if (!found) throw new NotFoundException('Xabar topilmadi');
    return found;
  }

  /**
   * `chat:member` voqeasi: a'zo o'zi + (kanalda owner/adminlar, boshqa chatda hamma
   * a'zo) — minglab obunachiga har obuna haqida yuborilmaydi.
   */
  private async memberChange(chatId: string, type: ChatType, userId: string, action: WsChatMemberAction): Promise<MemberChange> {
    const [row, memberCount, audience] = await Promise.all([
      action === 'removed'
        ? null
        : this.prisma.chatMember.findUniqueOrThrow({
            where:   { chatId_userId: { chatId, userId } },
            include: { user: true },
          }),
      this.prisma.chatMember.count({ where: { chatId } }),
      this.prisma.chatMember.findMany({
        where:  { chatId, ...(type === 'channel' ? { role: { in: ['owner', 'admin'] as ChatRole[] } } : {}) },
        select: { userId: true },
      }),
    ]);
    return {
      event: {
        chatId,
        userId,
        action,
        member: row ? toChatMember(row) : null,
        memberCount,
      },
      recipientIds: [...new Set([...audience.map((a) => a.userId), userId])],
    };
  }

  private present(m: MessageRow, attachment: AttachmentRow | null): Promise<Message> {
    return (attachment ? this.media.toDto(attachment) : Promise.resolve(null)).then((a) => toMessage(m, a));
  }

  private async presentLast(m: (MessageRow & { attachment: AttachmentRow | null }) | undefined): Promise<Message | null> {
    return m ? this.present(m, m.attachment) : null;
  }

  private async unreadCounts(me: string, chatId?: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ chat_id: string; unread: number }[]>`
      SELECT cm.chat_id, COUNT(m.id)::int AS unread
      FROM chat_members cm
      JOIN messages m
        ON m.chat_id = cm.chat_id
       AND m.sender_id <> cm.user_id
       AND m.deleted_at IS NULL
       AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
      WHERE cm.user_id = ${me}::uuid
        ${chatId ? Prisma.sql`AND cm.chat_id = ${chatId}::uuid` : Prisma.empty}
      GROUP BY cm.chat_id`;
    return new Map(rows.map((r) => [r.chat_id, r.unread]));
  }
}
