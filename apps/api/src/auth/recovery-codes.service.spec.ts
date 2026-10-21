import { normalizeRecoveryCode, RECOVERY_CODE_ALPHABET, RECOVERY_CODE_LENGTH } from '@suhbat/core';
import { describe, expect, it } from 'vitest';
import { generateRecoveryCode } from './recovery-codes.service';

describe('generateRecoveryCode', () => {
  it('12 belgi, faqat alifbodan; normallashtirishdan o\'zgarmay o\'tadi; takrorlanmaydi', () => {
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const c = generateRecoveryCode();
      expect(c).toHaveLength(RECOVERY_CODE_LENGTH);
      expect(normalizeRecoveryCode(c)).toBe(c);
      seen.add(c);
      for (const ch of c) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(seen.size).toBe(2000);
    // 24 000 belgi / 32 harf ≈ 750 — har harf ishlatiladi, keskin og'ish yo'q
    expect(counts.size).toBe(RECOVERY_CODE_ALPHABET.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(550);
  });
});
