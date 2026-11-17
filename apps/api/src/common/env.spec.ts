import { describe, expect, it } from 'vitest';
import { validateBootEnv } from './env';

const secret = 'x'.repeat(32);

describe('validateBootEnv', () => {
  it('production + bo‘sh CORS_ORIGIN → xato', () => {
    expect(() => validateBootEnv({ NODE_ENV: 'production', JWT_SECRET: secret })).toThrow(/CORS_ORIGIN/);
    expect(() => validateBootEnv({ NODE_ENV: 'production', JWT_SECRET: secret, CORS_ORIGIN: ' , ' })).toThrow(
      /CORS_ORIGIN/,
    );
  });
  it('production + CORS_ORIGIN → ro‘yxat', () => {
    const r = validateBootEnv({ NODE_ENV: 'production', JWT_SECRET: secret, CORS_ORIGIN: 'https://a.uz, suhbat://app' });
    expect(r.corsOrigins).toEqual(['https://a.uz', 'suhbat://app']);
  });
  it('dev + bo‘sh CORS_ORIGIN → true', () => {
    expect(validateBootEnv({ JWT_SECRET: secret }).corsOrigins).toBe(true);
  });
  it('qisqa JWT_SECRET → xato', () => {
    expect(() => validateBootEnv({ JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
