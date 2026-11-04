import { REACTION_EMOJIS, REPLY_PREVIEW_MAX } from '@suhbat/core';
import type { ChatMember, ChatSummary, Message, MessageReaction, MessageReply, ReactionEmoji } from '@suhbat/core';
import type {
  Attachment as AttachmentRow,
  Chat as ChatRow,
  ChatMember as MemberRow,
  Message as MessageRow,
  User as UserRow,
} from '../generated/prisma/client';
import { toPublicUser } from '../auth/auth.service';

export const toChatMember = (m: MemberRow & { user: UserRow }): ChatMember => ({
  user:       toPublicUser(m.user),
  role:       m.role,
  lastReadAt: m.lastReadAt?.toISOString() ?? null,
  lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
});

/** Javob berilgan xabar qatori (biriktirma turi bilan). */
export type ReplyRow = MessageRow & { attachment: Pick<AttachmentRow, 'kind'> | null };

/** `max` UTF-16 birligigacha qisqartiradi, emoji (surrogat juftlik) o'rtasidan kesmaydi. */
export const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
};

/** Asl xabarning qisqa ko'rinishi; o'chirilgan bo'lsa matn va tur yashiriladi. */
export const toReply = (r: ReplyRow): MessageReply => {
  const deleted = r.deletedAt !== null;
  return {
    id:       r.id,
    senderId: r.senderId,
    content:  deleted ? '' : truncate(r.content, REPLY_PREVIEW_MAX),
    kind:     deleted ? null : r.attachment?.kind ?? null,
    deleted,
  };
};

export interface ReactionRow {
  emoji:  string;
  userId: string;
}

const isReactionEmoji = (e: string): e is ReactionEmoji => (REACTION_EMOJIS as readonly string[]).includes(e);

/** Reaksiya qatorlari → emoji bo'yicha hisob (`REACTION_EMOJIS` tartibida) va `me` ning reaksiyasi. */
export const summarizeReactions = (
  rows: readonly ReactionRow[],
  me: string | null,
): { reactions: MessageReaction[]; myReaction: ReactionEmoji | null } => {
  const counts = new Map<ReactionEmoji, number>();
  let myReaction: ReactionEmoji | null = null;
  for (const r of rows) {
    if (!isReactionEmoji(r.emoji)) continue;
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.userId === me) myReaction = r.emoji;
  }
  return { reactions: orderedCounts(counts), myReaction };
};

/** Emoji → son jadvalini `REACTION_EMOJIS` tartibidagi ro'yxatga aylantiradi (ruxsat etilmagan emoji tashlanadi). */
export const orderedCounts = (counts: ReadonlyMap<string, number>): MessageReaction[] =>
  REACTION_EMOJIS.filter((e) => counts.has(e)).map((emoji) => ({ emoji, count: counts.get(emoji)! }));

/** Biriktirma imzolangan URL talab qiladi (async) — `ChatsService.present` qo'shadi. */
export const toMessage = (
  m: MessageRow,
  attachment: Message['attachment'],
  replyTo: ReplyRow | null = null,
  /** Berilsa — reaksiyalar va `myReaction` qo'yiladi; berilmasa maydonlar yo'q (mijoz mavjudini saqlaydi). */
  reactions?: { rows: readonly ReactionRow[]; me: string },
): Message => ({
  id:         m.id,
  chatId:     m.chatId,
  senderId:   m.senderId,
  type:       m.type,
  content:    m.content,
  attachment,
  createdAt:  m.createdAt.toISOString(),
  editedAt:   m.editedAt?.toISOString() ?? null,
  replyTo:    replyTo ? toReply(replyTo) : null,
  ...(reactions ? summarizeReactions(reactions.rows, reactions.me) : {}),
});

export type ChatWithRelations = ChatRow & {
  members: (MemberRow & { user: UserRow })[];
  _count:  { members: number };
};

export const toSummary = (c: ChatWithRelations, unreadCount: number, lastMessage: Message | null): ChatSummary => ({
  id:          c.id,
  type:        c.type,
  title:       c.title,
  description: c.description,
  isPublic:    c.isPublic,
  createdAt:   c.createdAt.toISOString(),
  updatedAt:   c.updatedAt.toISOString(),
  members:     c.members.map(toChatMember),
  memberCount: c._count.members,
  lastMessage,
  unreadCount,
});

/**
 * Keyset pagination kursori: oxirgi (eng eski) xabarning `(createdAt, id)`
 * juftligi, base64url. Mijoz uchun opaque satr.
 */
export const encodeCursor = (m: Pick<MessageRow, 'createdAt' | 'id'>): string =>
  Buffer.from(`${m.createdAt.toISOString()}|${m.id}`).toString('base64url');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const decodeCursor = (cursor: string): { createdAt: Date; id: string } | null => {
  const [iso, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !iso || !id || !UUID_RE.test(id)) return null;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
};
