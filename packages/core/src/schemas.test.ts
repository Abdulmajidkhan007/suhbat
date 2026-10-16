import { describe, expect, it } from 'vitest';
import {
  BIO_MAX, ChatMemberSchema, DISPLAY_NAME_MAX, LoginInputSchema, MessageSchema, PublicUserSchema, RegisterInputSchema, REPLY_PREVIEW_MAX,
  SendMessageInputSchema, UpdateProfileInputSchema, UserSchema,
} from './schemas.js';

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
  it('`login` (email yoki username) va eski `email` maydonini qabul qiladi', () => {
    expect(LoginInputSchema.parse({ login: ' Ali_01 ', password: 'y' })).toEqual({ login: 'Ali_01', password: 'y' });
    expect(LoginInputSchema.parse({ email: 'a@b.uz', password: 'y' })).toEqual({ login: 'a@b.uz', password: 'y' });
  });

  it('bo\'sh login yoki parolni rad etadi', () => {
    expect(LoginInputSchema.safeParse({ password: 'y' }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ login: '  ', password: 'y' }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ login: 'ali', password: '' }).success).toBe(false);
  });
});

describe('RegisterInputSchema username', () => {
  it('ixtiyoriy; berilsa normallashtiriladi va tekshiriladi', () => {
    const base = { email: ' A@B.uz ', password: '12345678', displayName: 'A' };
    expect(RegisterInputSchema.parse(base)).not.toHaveProperty('username');
    expect(RegisterInputSchema.parse(base).email).toBe('a@b.uz');
    expect(RegisterInputSchema.parse({ ...base, username: '@Ali_Valiyev' }).username).toBe('ali_valiyev');
    expect(RegisterInputSchema.safeParse({ ...base, username: 'admin' }).success).toBe(false);
  });
});

describe('PublicUser / User', () => {
  const pub = { id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', displayName: 'Ali', photoUrl: null, bio: null, username: null, createdAt: '2026-10-11T10:00:00.000Z' };

  it('PublicUser emailsiz, email kelsa ham tashlab yuboradi; User email talab qiladi', () => {
    expect(PublicUserSchema.parse({ ...pub, email: 'a@b.uz' })).toEqual(pub);
    expect(UserSchema.safeParse(pub).success).toBe(false);
    expect(UserSchema.parse({ ...pub, email: 'a@b.uz' }).email).toBe('a@b.uz');
  });

  it('eski server javobida username yo\'q — null', () => {
    const old: Record<string, unknown> = { ...pub };
    delete old.username;
    expect(PublicUserSchema.parse(old).username).toBeNull();
  });

  it('chat a\'zosi — PublicUser (email yo\'q)', () => {
    const m = ChatMemberSchema.parse({ user: { ...pub, email: 'a@b.uz' }, role: 'member', lastReadAt: null, lastSeenAt: null });
    expect(m.user).not.toHaveProperty('email');
  });
});

describe('UpdateProfileInputSchema', () => {
  it('ism va bio kesiladi (trim), faqat berilgan maydonlar qoladi', () => {
    expect(UpdateProfileInputSchema.parse({ displayName: '  Ali  ' })).toEqual({ displayName: 'Ali' });
    expect(UpdateProfileInputSchema.parse({ bio: '  Salom  ' })).toEqual({ bio: 'Salom' });
    expect(UpdateProfileInputSchema.parse({ bio: null })).toEqual({ bio: null });
  });

  it('bo\'sh ism, bo\'sh tanasi va uzun qiymatlarni rad etadi', () => {
    expect(UpdateProfileInputSchema.safeParse({ displayName: '   ' }).success).toBe(false);
    expect(UpdateProfileInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateProfileInputSchema.parse({ username: 'Ali_Valiyev' })).toEqual({ username: 'ali_valiyev' });
    expect(UpdateProfileInputSchema.parse({ username: null })).toEqual({ username: null });
    expect(UpdateProfileInputSchema.parse({ username: '' })).toEqual({ username: '' });
    expect(UpdateProfileInputSchema.safeParse({ username: 'ab' }).success).toBe(false);
    expect(UpdateProfileInputSchema.safeParse({ displayName: 'x'.repeat(DISPLAY_NAME_MAX + 1) }).success).toBe(false);
    expect(UpdateProfileInputSchema.safeParse({ bio: 'x'.repeat(BIO_MAX + 1) }).success).toBe(false);
    expect(UpdateProfileInputSchema.safeParse({ displayName: 'x'.repeat(DISPLAY_NAME_MAX), bio: 'x'.repeat(BIO_MAX) }).success).toBe(true);
  });
});

describe('javob (replyTo)', () => {
  const msg = {
    id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', chatId: '7f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
    senderId: '8f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', type: 'text', content: 'ha', attachment: null,
    createdAt: '2026-10-16T10:00:00.000Z', editedAt: null,
  };

  it('MessageSchema: replyTo ixtiyoriy (eski server), null yoki ko\'rinish', () => {
    expect(MessageSchema.parse(msg).replyTo).toBeUndefined();
    expect(MessageSchema.parse({ ...msg, replyTo: null }).replyTo).toBeNull();
    const replyTo = { id: msg.id, senderId: msg.senderId, content: 'salom', kind: null, deleted: false };
    expect(MessageSchema.parse({ ...msg, replyTo }).replyTo).toEqual(replyTo);
    expect(MessageSchema.safeParse({ ...msg, replyTo: { ...replyTo, content: 'x'.repeat(REPLY_PREVIEW_MAX + 1) } }).success).toBe(false);
  });

  it('SendMessageInputSchema: replyToId — uuid', () => {
    expect(SendMessageInputSchema.safeParse({ content: 'ha', replyToId: msg.id }).success).toBe(true);
    expect(SendMessageInputSchema.safeParse({ content: 'ha', replyToId: 'yoq' }).success).toBe(false);
  });
});
