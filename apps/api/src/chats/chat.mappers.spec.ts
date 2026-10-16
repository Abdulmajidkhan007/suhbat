import { describe, expect, it } from 'vitest';
import { toSelfUser } from '../auth/auth.service';
import { decodeCursor, encodeCursor, toChatMember } from './chat.mappers';
import { directKeyOf } from './chats.service';

describe('kursor', () => {
  const m = { createdAt: new Date('2026-10-11T10:00:00.123Z'), id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f' };

  it('encode → decode bir xil qiymat beradi', () => {
    expect(decodeCursor(encodeCursor(m))).toEqual(m);
  });

  it('buzilgan kursorga null', () => {
    expect(decodeCursor('salom')).toBeNull();
    expect(decodeCursor(Buffer.from('2026-10-11T10:00:00Z|not-a-uuid').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from(`ertaga|${m.id}`).toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from(`2026-10-11T10:00:00Z|${m.id}|x`).toString('base64url'))).toBeNull();
  });
});

describe('directKeyOf', () => {
  it('tartibdan qat\'i nazar bir xil kalit', () => {
    expect(directKeyOf('b', 'a')).toBe('a:b');
    expect(directKeyOf('a', 'b')).toBe('a:b');
  });
});

describe('foydalanuvchi ko\'rinishlari', () => {
  const row = {
    id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', email: 'ali@test.uz', username: 'ali_v', passwordHash: 'x', displayName: 'Ali',
    photoUrl: null, bio: null, createdAt: new Date('2026-10-11T10:00:00Z'), updatedAt: new Date(), lastSeenAt: null, notificationPreview: true,
  };

  it('chat a\'zosida email va passwordHash yo\'q; o\'zi uchun email bor', () => {
    const member = toChatMember({ chatId: 'c', userId: row.id, role: 'member', lastReadAt: null, joinedAt: new Date(), user: row });
    expect(JSON.stringify(member)).not.toContain('ali@test.uz');
    expect(member.user).not.toHaveProperty('email');
    expect(member.user).not.toHaveProperty('passwordHash');
    expect(toSelfUser(row).email).toBe('ali@test.uz');
    expect(toSelfUser(row)).not.toHaveProperty('passwordHash');
  });
});
