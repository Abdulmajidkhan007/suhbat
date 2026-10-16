import { avatarColor, formatChatTime, formatCount, formatDayLabel, formatLastSeen, formatTime, initials, sameDay } from './format';

// Mahalliy vaqt: 2026-10-16 (payshanba) 15:00.
const NOW = new Date(2026, 9, 16, 15, 0);
const at = (y: number, m: number, d: number, h = 10, min = 5) => new Date(y, m, d, h, min).toISOString();

describe('format', () => {
  it('vaqt 24 soatlik', () => {
    expect(formatTime(at(2026, 9, 16, 9, 7))).toBe('09:07');
    expect(formatTime(at(2026, 9, 16, 21, 30))).toBe('21:30');
    expect(formatTime('yaroqsiz')).toBe('');
  });

  it('ro\'yxat vaqti: bugun / kecha / hafta kuni / shu yil / eski', () => {
    expect(formatChatTime(at(2026, 9, 16, 14, 20), NOW)).toBe('14:20');
    expect(formatChatTime(at(2026, 9, 15), NOW)).toBe('Kecha');
    expect(formatChatTime(at(2026, 9, 12), NOW)).toBe('Du'); // 12-oktabr 2026 — dushanba
    expect(formatChatTime(at(2026, 2, 3), NOW)).toBe('3 mar');
    expect(formatChatTime(at(2025, 0, 5), NOW)).toBe('05.01.25');
  });

  it('sana ajratgichi', () => {
    expect(formatDayLabel(at(2026, 9, 16), NOW)).toBe('Bugun');
    expect(formatDayLabel(at(2026, 9, 15), NOW)).toBe('Kecha');
    expect(formatDayLabel(at(2026, 9, 1), NOW)).toBe('1-oktabr');
    expect(formatDayLabel(at(2025, 11, 31), NOW)).toBe('31-dekabr, 2025');
    expect(sameDay(at(2026, 9, 16, 0, 1), at(2026, 9, 16, 23, 59))).toBe(true);
    expect(sameDay(at(2026, 9, 16, 23, 59), at(2026, 9, 17, 0, 1))).toBe(false);
  });

  it('oxirgi marta', () => {
    expect(formatLastSeen(at(2026, 9, 16, 14, 20), NOW)).toBe('bugun 14:20 da');
    expect(formatLastSeen(at(2026, 9, 15, 8, 0), NOW)).toBe('kecha 08:00 da');
    expect(formatLastSeen(at(2026, 0, 5), NOW)).toBe('05.01.2026 da');
  });

  it('bosh harflar (emoji/bo\'sh joy bilan buzilmaydi), avatar rangi barqaror, sonlar', () => {
    expect(initials('Ali Valiyev')).toBe('AV');
    expect(initials('  ')).toBe('?');
    expect(initials('😀 Kulgu')).toBe('😀K');
    expect(avatarColor('abc')).toBe(avatarColor('abc'));
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1200)).toBe('1,2K');
    expect(formatCount(25_000)).toBe('25K');
    expect(formatCount(1_500_000)).toBe('1,5M');
  });
});
