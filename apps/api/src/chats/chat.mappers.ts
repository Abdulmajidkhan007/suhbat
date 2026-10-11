import type { ChatSummary, Message } from '@suhbat/core';
import type {
  Chat as ChatRow,
  ChatMember as MemberRow,
  Message as MessageRow,
  User as UserRow,
} from '../generated/prisma/client';
import { toPublicUser } from '../auth/auth.service';

export const toMessage = (m: MessageRow): Message => ({
  id:        m.id,
  chatId:    m.chatId,
  senderId:  m.senderId,
  type:      m.type,
  content:   m.content,
  createdAt: m.createdAt.toISOString(),
  editedAt:  m.editedAt?.toISOString() ?? null,
});

export type ChatWithRelations = ChatRow & {
  members:  (MemberRow & { user: UserRow })[];
  messages: MessageRow[];
};

export const toSummary = (c: ChatWithRelations, unreadCount: number): ChatSummary => ({
  id:        c.id,
  type:      c.type,
  title:     c.title,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  members:   c.members.map((m) => ({
    user:       toPublicUser(m.user),
    role:       m.role,
    lastReadAt: m.lastReadAt?.toISOString() ?? null,
    lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
  })),
  lastMessage: c.messages[0] ? toMessage(c.messages[0]) : null,
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
