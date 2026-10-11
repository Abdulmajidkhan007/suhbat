import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RegisterInputSchema } from './schemas.js';

describe('RegisterInputSchema', () => {
  it('emailni kichik harfga o\'giradi', () => {
    const r = RegisterInputSchema.parse({ email: 'Ali@Example.COM', password: '12345678', displayName: ' Ali ' });
    expect(r.email).toBe('ali@example.com');
    expect(r.displayName).toBe('Ali');
  });

  it('qisqa parolni rad etadi', () => {
    expect(RegisterInputSchema.safeParse({ email: 'a@b.uz', password: '123', displayName: 'A' }).success).toBe(false);
  });
});

describe('LoginInputSchema', () => {
  it('noto\'g\'ri emailni rad etadi', () => {
    expect(LoginInputSchema.safeParse({ email: 'x', password: 'y' }).success).toBe(false);
  });
});
