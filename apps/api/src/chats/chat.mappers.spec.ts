import { describe, expect, it } from 'vitest';
import { toSelfUser } from '../auth/auth.service';
import { decodeCursor, encodeCursor, orderedCounts, summarizeReactions, toChatMember, toMessage, toReply, truncate } from './chat.mappers';
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

describe('javob (replyTo) ko\'rinishi', () => {
  const base = {
    id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', chatId: '7f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
    senderId: '8f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', type: 'text' as const, content: 'salom',
    createdAt: new Date(), editedAt: null, deletedAt: null, replyToId: null, attachment: null,
  };

  it('qisqartirish UTF-16 chegarasida, emoji o\'rtasidan kesmaydi', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('😀😀😀', 5)).toBe('😀😀');
    expect(truncate('😀😀😀', 5).length).toBeLessThanOrEqual(5);
  });

  it('tirik xabar — matn va biriktirma turi; o\'chirilgan — yashirin', () => {
    expect(toReply({ ...base, attachment: { kind: 'image' } })).toEqual({
      id: base.id, senderId: base.senderId, content: 'salom', kind: 'image', deleted: false,
    });
    expect(toReply({ ...base, content: '', deletedAt: new Date(), attachment: { kind: 'image' } })).toEqual({
      id: base.id, senderId: base.senderId, content: '', kind: null, deleted: true,
    });
  });
});

describe('reaksiyalar ko\'rinishi', () => {
  const rows = [
    { emoji: '🔥', userId: 'a' }, { emoji: '👍', userId: 'b' }, { emoji: '🔥', userId: 'c' }, { emoji: '💩', userId: 'd' },
  ];

  it('emoji tartibida hisoblaydi, ruxsat etilmaganini tashlaydi, o\'zining reaksiyasini topadi', () => {
    expect(summarizeReactions(rows, 'c')).toEqual({
      reactions:  [{ emoji: '👍', count: 1 }, { emoji: '🔥', count: 2 }],
      myReaction: '🔥',
    });
    expect(summarizeReactions(rows, 'z').myReaction).toBeNull();
    expect(summarizeReactions([], 'a')).toEqual({ reactions: [], myReaction: null });
  });

  it('orderedCounts: bo\'sh emoji chiqmaydi', () => {
    expect(orderedCounts(new Map([['😢', 3], ['❤️', 1]]))).toEqual([{ emoji: '❤️', count: 1 }, { emoji: '😢', count: 3 }]);
  });

  it('toMessage: reaksiya berilmasa maydonlar yo\'q (mijoz mavjudini saqlaydi), berilsa bor', () => {
    const m = {
      id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', chatId: '7f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
      senderId: '8f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', type: 'text' as const, content: 'x',
      createdAt: new Date(), editedAt: null, deletedAt: null, replyToId: null,
    };
    expect(toMessage(m, null)).not.toHaveProperty('reactions');
    expect(toMessage(m, null)).not.toHaveProperty('myReaction');
    expect(toMessage(m, null, null, { rows, me: 'b' })).toMatchObject({ myReaction: '👍', reactions: [{ emoji: '👍', count: 1 }, { emoji: '🔥', count: 2 }] });
  });
});
