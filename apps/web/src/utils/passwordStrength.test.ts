import { describe, expect, it } from 'vitest';
import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['1234567', 0],
    ['11111111', 1],
    ['abcdefgh', 1],
    ['abcdefg1', 2],
    ['Abcdefg1', 3],
    ['Abcdefg1!xyz', 4],
    ['correct horse battery staple', 4],
  ])('%s → %i', (pw, level) => {
    expect(passwordStrength(pw).level).toBe(level);
  });
});
