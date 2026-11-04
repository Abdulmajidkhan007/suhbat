import { describe, expect, it } from 'vitest';
import { applyMyReaction, toggleReaction } from './reactions.js';
import { MessageSchema, REACTION_EMOJIS, SetReactionInputSchema } from './schemas.js';

describe('applyMyReaction', () => {
  it('yangi reaksiya qo\'shiladi, emoji tartibida', () => {
    expect(applyMyReaction([{ emoji: '🔥', count: 1 }], null, '👍')).toEqual([
      { emoji: '👍', count: 1 }, { emoji: '🔥', count: 1 },
    ]);
  });

  it('almashtirish: eskisi kamayadi (0 bo\'lsa chiqmaydi), yangisi ko\'payadi', () => {
    expect(applyMyReaction([{ emoji: '👍', count: 1 }, { emoji: '🔥', count: 2 }], '👍', '🔥')).toEqual([{ emoji: '🔥', count: 3 }]);
    expect(applyMyReaction([{ emoji: '👍', count: 2 }], '👍', '😢')).toEqual([{ emoji: '👍', count: 1 }, { emoji: '😢', count: 1 }]);
  });

  it('olib tashlash va manfiy bo\'lmaslik', () => {
    expect(applyMyReaction([{ emoji: '❤️', count: 1 }], '❤️', null)).toEqual([]);
    expect(applyMyReaction([], '❤️', null)).toEqual([]);
  });
});

describe('toggleReaction', () => {
  it('o\'zining reaksiyasini yana bossa — olib tashlash, boshqasini — almashtirish', () => {
    expect(toggleReaction('👍', '👍')).toBeNull();
    expect(toggleReaction('👍', '🔥')).toBe('🔥');
    expect(toggleReaction(null, '🔥')).toBe('🔥');
    expect(toggleReaction(undefined, '🔥')).toBe('🔥');
  });
});

describe('reaksiya sxemalari', () => {
  it('SetReactionInput: faqat ruxsat etilgan emoji yoki null', () => {
    for (const e of REACTION_EMOJIS) expect(SetReactionInputSchema.safeParse({ emoji: e }).success).toBe(true);
    expect(SetReactionInputSchema.safeParse({ emoji: null }).success).toBe(true);
    expect(SetReactionInputSchema.safeParse({ emoji: '💩' }).success).toBe(false);
    expect(SetReactionInputSchema.safeParse({ emoji: '👍👍' }).success).toBe(false);
    expect(SetReactionInputSchema.safeParse({}).success).toBe(false);
  });

  it('Message: reactions/myReaction ixtiyoriy (eski server)', () => {
    const msg = {
      id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', chatId: '7f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
      senderId: '8f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f', type: 'text', content: 'x', attachment: null,
      createdAt: '2026-11-04T10:00:00.000Z', editedAt: null,
    };
    expect(MessageSchema.safeParse(msg).success).toBe(true);
    expect(MessageSchema.safeParse({ ...msg, reactions: [{ emoji: '👍', count: 2 }], myReaction: '👍' }).success).toBe(true);
    expect(MessageSchema.safeParse({ ...msg, reactions: [{ emoji: '💩', count: 1 }] }).success).toBe(false);
    expect(MessageSchema.safeParse({ ...msg, reactions: [{ emoji: '👍', count: 0 }] }).success).toBe(false);
  });
});
