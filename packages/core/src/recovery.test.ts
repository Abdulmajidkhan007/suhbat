import { describe, expect, it } from 'vitest';
import { formatRecoveryCode, normalizeRecoveryCode, RECOVERY_CODE_ALPHABET } from './schemas.js';

describe('tiklash kodi', () => {
  it('normallashtirish: katta harf, ajratgichsiz, O→0, I/L→1', () => {
    expect(normalizeRecoveryCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(normalizeRecoveryCode(' abcd efgh jkmn ')).toBe('ABCDEFGHJKMN');
    expect(normalizeRecoveryCode('OOOO-IIII-LLLL')).toBe('000011111111');
  });

  it('noto\'g\'ri uzunlik yoki belgi — null', () => {
    expect(normalizeRecoveryCode('ABCD-EFGH')).toBeNull();
    expect(normalizeRecoveryCode('ABCD-EFGH-JKMNP')).toBeNull();
    expect(normalizeRecoveryCode('ABCD-EFGH-JKMU')).toBeNull(); // U alifboda yo'q
    expect(normalizeRecoveryCode('ABCD-EFGH-JK#N')).toBeNull();
  });

  it('format: 4 tadan guruh; alifbo 32 belgi, chalkash harflarsiz', () => {
    expect(formatRecoveryCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
    expect(RECOVERY_CODE_ALPHABET).toHaveLength(32);
    for (const ch of 'ILOU') expect(RECOVERY_CODE_ALPHABET).not.toContain(ch);
  });
});
