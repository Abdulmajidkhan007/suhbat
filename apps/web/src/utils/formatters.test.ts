import { describe, expect, it } from 'vitest';
import { formatChatTime, formatDuration, formatLastSeen, formatMessageTime, messagePreview } from './formatters';

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

  it('kecha uchun "Kecha"', () => {
    expect(formatChatTime(Date.now() - 24 * 60 * 60 * 1000)).toBe('Kecha');
  });

  it('bugun — 24 soatlik vaqt (AM/PM yo\'q)', () => {
    const now = new Date();
    now.setHours(14, 20, 0, 0);
    if (now.getTime() > Date.now()) now.setDate(now.getDate() - 1); // kelajakka tushmasin
    const out = formatChatTime(new Date(2026, 9, 14, 14, 20).getTime());
    expect(out).not.toMatch(/AM|PM/);
  });

  it('hafta ichida o\'zbekcha kun nomi, undan eskisi — kun.oy.yil', () => {
    const threeDays = formatChatTime(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(threeDays).toMatch(/^(Dushanba|Seshanba|Chorshanba|Payshanba|Juma|Shanba|Yakshanba)$/);
    expect(formatChatTime(new Date(2020, 0, 5).getTime())).toBe('05.01.2020');
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
    expect(formatMessageTime(fakeTimestamp(d))).toBe('14:05');
    expect(formatMessageTime(d.getTime())).toBe('14:05');
  });

  it('pending serverTimestamp (null) da yiqilmaydi', () => {
    expect(formatMessageTime(null)).toBe('');
  });
});

describe('messagePreview / formatDuration', () => {
  it('biriktirmada izoh bo\'lmasa turini ko\'rsatadi', () => {
    expect(messagePreview('salom', 'text')).toBe('salom');
    expect(messagePreview('', 'image')).toBe('Rasm');
    expect(messagePreview('', 'voice')).toBe('Ovozli xabar');
    expect(messagePreview('', 'file')).toBe('Fayl');
    expect(messagePreview('izoh', 'image')).toBe('izoh');
  });

  it('davomiylik m:ss', () => {
    expect(formatDuration(4200)).toBe('0:04');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatLastSeen', () => {
  it('bugun, kecha, eski sana va noma\'lum', () => {
    const today = new Date(); today.setHours(9, 5, 0, 0);
    // kun boshiga yaqin ishga tushsa ham "bugun" bo'lib qolishi uchun 00:00 dan keyingi vaqt
    expect(formatLastSeen(today.getTime())).toBe('bugun 09:05 da');
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(23, 30, 0, 0);
    expect(formatLastSeen(y.getTime())).toBe('kecha 23:30 da');
    expect(formatLastSeen(new Date(2020, 0, 5, 10).getTime())).toBe('05.01.2020 da');
    expect(formatLastSeen(0)).toBe('yaqinda emas');
    expect(formatLastSeen(null)).toBe('yaqinda emas');
  });
});
