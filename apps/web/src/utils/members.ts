import type { ChatParticipant, ChatType } from '../types';

/**
 * Kanal API'si faqat owner/adminlar va so'rayotgan foydalanuvchining o'zini qaytaradi
 * (`myRole` uchun) — shuning uchun oddiy obunachi o'zini ham ko'radi. "Ega va adminlar"
 * ro'yxatida faqat boshqaruvchilar bo'lishi kerak; guruhda — hamma a'zo.
 */
export const listedMembers = (type: ChatType, members: readonly ChatParticipant[]): ChatParticipant[] =>
  type === 'channel' ? members.filter((m) => (m.role ?? 'member') !== 'member') : [...members];

/** Kanalda obunachi = jami a'zolar − ega va adminlar (ular alohida ko'rsatiladi). */
export const subscriberCount = (memberCount: number, members: readonly ChatParticipant[]): number =>
  Math.max(0, memberCount - members.filter((m) => (m.role ?? 'member') !== 'member').length);
