import type { ChatMember, Message, MessageStatus } from './schemas.js';
import { toMillis } from './time.js';

/**
 * O'z xabarimiz holati: boshqa a'zolardan kamida bittasining `lastReadAt`
 * vaqti xabar vaqtidan kech yoki teng bo'lsa — `read`, aks holda `sent`.
 */
export const messageStatus = (
  message: Pick<Message, 'senderId' | 'createdAt'>,
  members: Pick<ChatMember, 'lastReadAt' | 'user'>[],
): MessageStatus => {
  const sentAt = toMillis(message.createdAt);
  if (sentAt === null) return 'sent';
  const read = members.some((m) => {
    if (m.user.id === message.senderId) return false;
    const readAt = toMillis(m.lastReadAt);
    return readAt !== null && readAt >= sentAt;
  });
  return read ? 'read' : 'sent';
};
