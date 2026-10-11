import { describe, expect, it } from 'vitest';
import { formatChatTime, formatMessageTime } from './formatters';

// Firestore `Timestamp` ning o'qishda keladigan shakli (SDK'siz).
const fakeTimestamp = (date: Date) => ({
  seconds:     Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toMillis:    () => date.getTime(),
});

describe('formatChatTime', () => {
  it('Firestore Timestamp bilan yiqilmaydi ("Invalid time value" regressiyasi)', () => {
    const now = new Date();
    expect(() => formatChatTime(fakeTimestamp(now))).not.toThrow();
    expect(formatChatTime(fakeTimestamp(now))).toBe(formatChatTime(now.getTime()));
  });

  it('kecha uchun "Yesterday"', () => {
    expect(formatChatTime(Date.now() - 24 * 60 * 60 * 1000)).toBe('Yesterday');
  });

  it('noto\'g\'ri qiymatda bo\'sh satr', () => {
    expect(formatChatTime(null)).toBe('');
    expect(formatChatTime(undefined)).toBe('');
    expect(formatChatTime({})).toBe('');
  });
});

describe('formatMessageTime', () => {
  it('Timestamp va raqam bir xil natija beradi', () => {
    const d = new Date(2026, 9, 11, 14, 5);
    expect(formatMessageTime(fakeTimestamp(d))).toBe('2:05 PM');
    expect(formatMessageTime(d.getTime())).toBe('2:05 PM');
  });

  it('pending serverTimestamp (null) da yiqilmaydi', () => {
    expect(formatMessageTime(null)).toBe('');
  });
});
