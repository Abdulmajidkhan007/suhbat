// API (`@suhbat/core`) tiplarini UI tiplariga keltirish. Vaqtlar — ms.
import { toMillis } from '@suhbat/core';
import type { ChatSummary, Message as ApiMessage, User } from '@suhbat/core';
import type { AppUser, Chat, ChatParticipant, Message } from '../types';

const ms = (value: unknown, fallback = Date.now()): number => toMillis(value) ?? fallback;

export const toAppUser = (u: User): AppUser => ({
  uid:         u.id,
  email:       u.email,
  displayName: u.displayName,
  photoURL:    u.photoUrl,
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
    createdAt:   ms(m.createdAt),
    updatedAt:   ms(m.editedAt ?? m.createdAt),
  };
};

export const toChat = (c: ChatSummary, currentUid: string): Chat => {
  const details: Record<string, ChatParticipant> = {};
  for (const m of c.members) {
    details[m.user.id] = {
      uid:         m.user.id,
      displayName: m.user.displayName,
      photoURL:    m.user.photoUrl,
      isOnline:    false,
      lastSeen:    toMillis(m.lastSeenAt) ?? 0,
      lastReadAt:  toMillis(m.lastReadAt),
      role:        m.role,
    };
  }
  const other = c.type === 'direct' ? c.members.find((m) => m.user.id !== currentUid) : undefined;
  return {
    id:                 c.id,
    name:               c.title ?? other?.user.displayName ?? 'Suhbat',
    type:               c.type,
    photoURL:           other?.user.photoUrl ?? null,
    participants:       c.members.map((m) => m.user.id),
    participantDetails: details,
    memberCount:        c.members.length,
    lastMessage:        c.lastMessage
      ? { content: c.lastMessage.content, senderId: c.lastMessage.senderId, createdAt: ms(c.lastMessage.createdAt) }
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
