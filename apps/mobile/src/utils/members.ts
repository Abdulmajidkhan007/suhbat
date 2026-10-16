import type { ChatMember, ChatRole, ChatType } from '@suhbat/core';

const ROLE_ORDER: Record<ChatRole, number> = { owner: 0, admin: 1, member: 2 };

/**
 * Kanal API'si faqat owner/adminlar va so'rayotgan foydalanuvchining o'zini qaytaradi — shuning uchun
 * kanalda faqat boshqaruvchilar ko'rsatiladi; guruhda — hamma. Tartib: ega, adminlar, qolganlar (ism bo'yicha).
 */
export const listedMembers = (type: ChatType, members: readonly ChatMember[]): ChatMember[] =>
  (type === 'channel' ? members.filter((m) => m.role !== 'member') : [...members])
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.displayName.localeCompare(b.user.displayName));

/** Kanalda obunachi = jami a'zolar − ega va adminlar. */
export const subscriberCount = (memberCount: number, members: readonly ChatMember[]): number =>
  Math.max(0, memberCount - members.filter((m) => m.role !== 'member').length);
