import type { ChatMember, ChatSummary, Message, PublicUser, User } from '@suhbat/core';

export const ME: User = {
  id:          '00000000-0000-4000-8000-000000000001',
  displayName: 'Ali Valiyev',
  email:       'ali@example.uz',
  photoUrl:    null,
  createdAt:   '2026-10-01T10:00:00.000Z',
};

export const PEER: PublicUser = {
  id:          '00000000-0000-4000-8000-000000000002',
  displayName: 'Vali',
  photoUrl:    null,
  createdAt:   '2026-10-01T10:00:00.000Z',
};

export const CHAT_ID = '00000000-0000-4000-8000-0000000000c1';

export const member = (user: PublicUser, lastReadAt: string | null = null): ChatMember => ({
  user, role: 'member', lastReadAt, lastSeenAt: null,
});

export const message = (n: number, senderId = PEER.id, chatId = CHAT_ID): Message => ({
  id:         `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  chatId,
  senderId,
  type:       'text',
  content:    `xabar ${n}`,
  attachment: null,
  createdAt:  new Date(Date.UTC(2026, 9, 12, 10, n)).toISOString(),
  editedAt:   null,
});

export const directChat = (overrides: Partial<ChatSummary> = {}): ChatSummary => ({
  id:          CHAT_ID,
  type:        'direct',
  title:       null,
  description: null,
  isPublic:    false,
  createdAt:   '2026-10-12T09:00:00.000Z',
  updatedAt:   '2026-10-12T09:00:00.000Z',
  members:     [member(ME), member(PEER)],
  memberCount: 2,
  lastMessage: null,
  unreadCount: 0,
  ...overrides,
});
