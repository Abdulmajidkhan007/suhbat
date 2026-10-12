import { describe, expect, it } from 'vitest';
import { ChatMemberSchema, LoginInputSchema, PublicUserSchema, RegisterInputSchema, UserSchema } from './schemas.js';

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

describe('PublicUser / User', () => {
  const pub = { id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', displayName: 'Ali', photoUrl: null, createdAt: '2026-10-11T10:00:00.000Z' };

  it('PublicUser emailsiz, email kelsa ham tashlab yuboradi; User email talab qiladi', () => {
    expect(PublicUserSchema.parse({ ...pub, email: 'a@b.uz' })).toEqual(pub);
    expect(UserSchema.safeParse(pub).success).toBe(false);
    expect(UserSchema.parse({ ...pub, email: 'a@b.uz' }).email).toBe('a@b.uz');
  });

  it('chat a\'zosi — PublicUser (email yo\'q)', () => {
    const m = ChatMemberSchema.parse({ user: { ...pub, email: 'a@b.uz' }, role: 'member', lastReadAt: null, lastSeenAt: null });
    expect(m.user).not.toHaveProperty('email');
  });
});
