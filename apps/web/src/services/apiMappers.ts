// API (`@suhbat/core`) tiplarini UI tiplariga keltirish. Vaqtlar — ms.
import { toMillis } from '@suhbat/core';
import type { ChatMember, ChatSummary, Message as ApiMessage, PublicUser, User } from '@suhbat/core';
import type { AppUser, Chat, ChatParticipant, Message } from '../types';
import { messagePreview } from '../utils/formatters';

const ms = (value: unknown, fallback = Date.now()): number => toMillis(value) ?? fallback;

/** `User` (email bilan) faqat o'zi uchun; boshqalar — `PublicUser`. */
export const toAppUser = (u: PublicUser | User): AppUser => ({
  uid:         u.id,
  email:       'email' in u ? u.email : undefined,
  displayName: u.displayName,
  username:    u.username,
  photoURL:    u.photoUrl,
  bio:         u.bio,
  createdAt:   ms(u.createdAt),
  lastSeen:    ms(u.createdAt),
  isOnline:    false,
});

export const toMessage = (m: ApiMessage, chat?: Pick<Chat, 'participantDetails'> | null): Message => {
  const sender = chat?.participantDetails[m.senderId];
  return {
    id:          m.id,
    chatId:      m.chatId,
    senderId:    m.senderId,
    senderName:  sender?.displayName ?? '',
    senderPhoto: sender?.photoURL ?? null,
    content:     m.content,
    type:        m.type,
    status:      'sent',
    attachment:  m.attachment
      ? {
          id:         m.attachment.id,
          kind:       m.attachment.kind,
          name:       m.attachment.name,
          url:        m.attachment.url,
          type:       m.attachment.mime,
          size:       m.attachment.size,
          durationMs: m.attachment.durationMs,
        }
      : undefined,
    createdAt:   ms(m.createdAt),
    updatedAt:   ms(m.editedAt ?? m.createdAt),
    editedAt:    toMillis(m.editedAt),
    replyTo:     m.replyTo ?? null,
  };
};

export const toParticipant = (m: ChatMember): ChatParticipant => ({
  uid:         m.user.id,
  displayName: m.user.displayName,
  photoURL:    m.user.photoUrl,
  isOnline:    false,
  lastSeen:    toMillis(m.lastSeenAt) ?? 0,
  lastReadAt:  toMillis(m.lastReadAt),
  role:        m.role,
});

export const toChat = (c: ChatSummary, currentUid: string): Chat => {
  const details: Record<string, ChatParticipant> = {};
  for (const m of c.members) details[m.user.id] = toParticipant(m);
  const other = c.type === 'direct' ? c.members.find((m) => m.user.id !== currentUid) : undefined;
  return {
    id:                 c.id,
    name:               c.title ?? other?.user.displayName ?? 'Suhbat',
    type:               c.type,
    photoURL:           other?.user.photoUrl ?? null,
    description:        c.description ?? undefined,
    participants:       c.members.map((m) => m.user.id),
    admins:             c.members.filter((m) => m.role === 'admin').map((m) => m.user.id),
    ownerId:            c.members.find((m) => m.role === 'owner')?.user.id,
    myRole:             c.members.find((m) => m.user.id === currentUid)?.role ?? 'member',
    isPublic:           c.isPublic,
    participantDetails: details,
    memberCount:        c.memberCount,
    lastMessage:        c.lastMessage
      ? {
          content:   messagePreview(c.lastMessage.content, c.lastMessage.type),
          senderId:  c.lastMessage.senderId,
          createdAt: ms(c.lastMessage.createdAt),
        }
      : null,
    unreadCount: c.unreadCount,
    createdAt:   ms(c.createdAt),
    updatedAt:   ms(c.updatedAt),
    typingUsers: {},
  };
};

/**
 * O'z xabarimiz holati: boshqa ishtirokchilardan biri shu vaqtgacha o'qigan
 * bo'lsa — `read`. Optimistik/xato holatlar o'zgarmaydi.
 */
export const withStatus = (m: Message, chat: Pick<Chat, 'participantDetails'> | null, currentUid: string): Message => {
  if (m.senderId !== currentUid || m.status === 'sending' || m.status === 'failed' || !chat) return m;
  const read = Object.values(chat.participantDetails).some(
    (p) => p.uid !== currentUid && p.lastReadAt != null && p.lastReadAt >= m.createdAt,
  );
  return read ? { ...m, status: 'read' } : m;
};
