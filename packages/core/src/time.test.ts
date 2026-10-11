import { describe, expect, it } from 'vitest';
import { toMillis } from './time.js';

describe('toMillis', () => {
  it('raqamni o\'zgartirmaydi', () => {
    expect(toMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('Date va ISO satrni o\'giradi', () => {
    const d = new Date('2026-10-11T10:00:00.000Z');
    expect(toMillis(d)).toBe(d.getTime());
    expect(toMillis('2026-10-11T10:00:00.000Z')).toBe(d.getTime());
  });

  it('Firestore Timestamp (toMillis) ni o\'giradi', () => {
    expect(toMillis({ toMillis: () => 42, seconds: 0, nanoseconds: 0 })).toBe(42);
  });

  it('{ seconds, nanoseconds } ni o\'giradi', () => {
    expect(toMillis({ seconds: 10, nanoseconds: 5_000_000 })).toBe(10_005);
  });

  it('noma\'lum qiymatga null qaytaradi', () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis('ertaga')).toBeNull();
    expect(toMillis(NaN)).toBeNull();
    expect(toMillis({})).toBeNull();
  });
});
