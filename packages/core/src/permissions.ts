import type { ChatRole, ChatType } from './schemas.js';

// A'zolik huquqlari — sof funksiyalar. API majburlaydi, veb UI shu bilan tugmalarni
// ko'rsatadi/yashiradi (server baribir tekshiradi).

/** Kanalda faqat owner/admin yozadi; direct va guruhda hamma a'zo. */
export const canWrite = (type: ChatType, role: ChatRole): boolean => type !== 'channel' || role !== 'member';

/** Guruh/kanal sozlamalari va a'zo qo'shish: owner va admin. */
export const canManage = (type: ChatType, role: ChatRole): boolean => type !== 'direct' && role !== 'member';

/** Birovning xabarini o'chirish (moderatsiya): guruh/kanalda owner va admin. */
export const canModerateMessages = canManage;

/** Owner hammani (egadan tashqari) chiqaradi; admin faqat oddiy a'zoni. */
export const canRemove = (actor: ChatRole, target: ChatRole): boolean => {
  if (target === 'owner') return false;
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'member';
};
