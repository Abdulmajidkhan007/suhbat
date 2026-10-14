// src/utils/formatters.ts
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { uz } from 'date-fns/locale';
import { toMillis } from '@suhbat/core';

// Vaqt qiymati raqam bo'lmasligi mumkin (Firestore `Timestamp`, ISO satr,
// hali to'ldirilmagan `serverTimestamp()` → null). Noto'g'ri qiymatda
// `date-fns` "Invalid time value" tashlaydi, shuning uchun bo'sh satr qaytadi.
const toDate = (timestamp: unknown): Date | null => {
  const ms = toMillis(timestamp);
  return ms === null ? null : new Date(ms);
};

/** 24 soatlik vaqt: "14:20". */
export const formatMessageTime = (timestamp: unknown): string => {
  const date = toDate(timestamp);
  return date ? format(date, 'HH:mm') : '';
};

/** Ro'yxat uchun: bugun — "14:20", kecha — "Kecha", hafta ichida — "Dushanba", aks holda "11.10.2026". */
export const formatChatTime = (timestamp: unknown): string => {
  const date = toDate(timestamp);
  if (!date) return '';
  if (isToday(date))     return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Kecha';
  if (differenceInDays(new Date(), date) < 7) {
    const day = format(date, 'EEEE', { locale: uz });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  return format(date, 'dd.MM.yyyy');
};

/** "Oxirgi marta": "bugun 14:20 da", "kecha 09:05 da", "11.10.2026 da"; noma'lum bo'lsa — "yaqinda emas". */
export const formatLastSeen = (timestamp: unknown): string => {
  const date = toDate(timestamp);
  if (!date || date.getTime() <= 0) return 'yaqinda emas';
  if (isToday(date))     return `bugun ${format(date, 'HH:mm')} da`;
  if (isYesterday(date)) return `kecha ${format(date, 'HH:mm')} da`;
  return `${format(date, 'dd.MM.yyyy')} da`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const truncate = (str: string, maxLength: number): string => {
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
};

/** Ro'yxat va "oxirgi xabar" uchun qisqa matn: biriktirmada izoh bo'lmasa — turi. */
export const messagePreview = (content: string, type: string): string => {
  if (content) return content;
  if (type === 'image') return 'Rasm';
  if (type === 'voice') return 'Ovozli xabar';
  if (type === 'file')  return 'Fayl';
  return '';
};

/** Ovozli xabar davomiyligi: 4200 → "0:04". */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
