// src/utils/formatters.ts
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { toMillis } from '@suhbat/core';

// Vaqt qiymati raqam bo'lmasligi mumkin (Firestore `Timestamp`, ISO satr,
// hali to'ldirilmagan `serverTimestamp()` → null). Noto'g'ri qiymatda
// `date-fns` "Invalid time value" tashlaydi, shuning uchun bo'sh satr qaytadi.
const toDate = (timestamp: unknown): Date | null => {
  const ms = toMillis(timestamp);
  return ms === null ? null : new Date(ms);
};

export const formatMessageTime = (timestamp: unknown): string => {
  const date = toDate(timestamp);
  return date ? format(date, 'h:mm a') : '';
};

export const formatChatTime = (timestamp: unknown): string => {
  const date = toDate(timestamp);
  if (!date) return '';
  if (isToday(date))     return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEEE');
  return format(date, 'MM/dd/yyyy');
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
