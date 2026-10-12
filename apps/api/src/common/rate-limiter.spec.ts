import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('oynada limitdan keyin rad etadi, oyna tugagach yana ruxsat beradi', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.take('a', 0)).toBe(true);
    expect(rl.take('a', 10)).toBe(true);
    expect(rl.take('a', 20)).toBe(false);
    expect(rl.take('a', 1000)).toBe(true);
  });

  it('kalitlar bir-biriga ta\'sir qilmaydi', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.take('a', 0)).toBe(true);
    expect(rl.take('b', 0)).toBe(true);
    expect(rl.take('a', 1)).toBe(false);
  });
});
