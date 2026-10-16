import { describe, expect, it } from 'vitest';
import { normalizeUsername, parseLoginIdentifier, UsernameSchema, usernameProblem } from './username.js';

describe('username', () => {
  it('normallashtiradi: bo\'sh joy, @, katta harf', () => {
    expect(normalizeUsername('  @Ali_Valiyev ')).toBe('ali_valiyev');
    expect(UsernameSchema.parse('@ALI01')).toBe('ali01');
  });

  it.each([
    ['ali01', null],
    ['a2345', null],
    ['a'.repeat(32), null],
    ['ali', 'kamida 5'],
    ['a'.repeat(33), "ko'pi bilan 32"],
    ['1alii', 'harf bilan'],
    ['_alii', 'harf bilan'],
    ['ali_v_', 'tugamasin'],
    ['ali__v', 'Ketma-ket'],
    ['ali-vali', 'Faqat lotin'],
    ['alī_vali', 'Faqat lotin'],
    ['admin', 'band'],
    ['support', 'band'],
    ['suhbat_rasmiy', 'band'],
  ])('%s → %s', (u, problem) => {
    const res = usernameProblem(u);
    if (problem === null) expect(res).toBeNull();
    else expect(res).toContain(problem);
  });

  it('login identifikatori: email yoki username', () => {
    expect(parseLoginIdentifier(' Ali@Mail.UZ ')).toEqual({ kind: 'email', value: 'ali@mail.uz' });
    expect(parseLoginIdentifier('Ali_01')).toEqual({ kind: 'username', value: 'ali_01' });
    expect(parseLoginIdentifier('@Ali_01')).toEqual({ kind: 'username', value: 'ali_01' });
  });
});
