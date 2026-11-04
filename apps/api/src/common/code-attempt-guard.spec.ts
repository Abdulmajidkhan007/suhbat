import { describe, expect, it } from 'vitest';
import { CodeAttemptGuard, retryAfterSeconds } from './code-attempt-guard';

const opts = { maxFailures: 5, blockMs: 15 * 60_000, cooldownMs: 45_000 };

describe('CodeAttemptGuard', () => {
  it('5-noto\'g\'ri urinishda blok boshlanadi; undan oldin yo\'q', () => {
    const g = new CodeAttemptGuard(opts);
    for (let i = 0; i < 4; i++) expect(g.recordFailure('a', 0)).toBe(0);
    expect(g.blockedFor('a', 0)).toBe(0);
    expect(g.recordFailure('a', 0)).toBe(opts.blockMs);
    expect(g.blockedFor('a', 1000)).toBe(opts.blockMs - 1000);
  });

  it('blok 15 daqiqadan keyin tugaydi va hisob qaytadan boshlanadi', () => {
    const g = new CodeAttemptGuard(opts);
    for (let i = 0; i < 5; i++) g.recordFailure('a', 0);
    expect(g.blockedFor('a', opts.blockMs - 1)).toBe(1);
    expect(g.blockedFor('a', opts.blockMs)).toBe(0);
    for (let i = 0; i < 4; i++) g.recordFailure('a', opts.blockMs);
    expect(g.blockedFor('a', opts.blockMs)).toBe(0);
  });

  it('to\'g\'ri kod noto\'g\'ri urinishlar hisobini nolga tushiradi', () => {
    const g = new CodeAttemptGuard(opts);
    for (let i = 0; i < 4; i++) g.recordFailure('a', 0);
    g.recordSuccess('a');
    for (let i = 0; i < 4; i++) g.recordFailure('a', 0);
    expect(g.blockedFor('a', 0)).toBe(0);
  });

  it('kalitlar mustaqil', () => {
    const g = new CodeAttemptGuard(opts);
    for (let i = 0; i < 5; i++) g.recordFailure('a', 0);
    expect(g.blockedFor('b', 0)).toBe(0);
  });

  it('kod so\'rash: 45 s kutish, keyin yana ruxsat', () => {
    const g = new CodeAttemptGuard(opts);
    expect(g.takeRequest('a', 0)).toBe(0);
    expect(g.takeRequest('a', 10_000)).toBe(35_000);
    expect(g.takeRequest('a', 45_000)).toBe(0);
    expect(g.takeRequest('b', 45_001)).toBe(0);
  });

  it('blokda kod so\'rash ham rad etiladi (qolgan blok vaqti bilan)', () => {
    const g = new CodeAttemptGuard(opts);
    for (let i = 0; i < 5; i++) g.recordFailure('a', 0);
    expect(g.takeRequest('a', 60_000)).toBe(opts.blockMs - 60_000);
  });

  it('retryAfterSeconds yuqoriga yaxlitlaydi, kamida 1', () => {
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(1500)).toBe(2);
    expect(retryAfterSeconds(900_000)).toBe(900);
  });
});
