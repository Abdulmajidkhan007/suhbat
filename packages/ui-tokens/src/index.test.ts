import { describe, expect, it } from 'vitest';
import { palettes, spacing } from './index.js';

describe('ui-tokens', () => {
  it('ikkala rejimda bir xil kalitlar', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  it('spacing — 4 px qadam', () => {
    expect(spacing(0)).toBe(0);
    expect(spacing(3)).toBe(12);
  });
});
