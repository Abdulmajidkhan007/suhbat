import { describe, expect, it } from 'vitest';
import { toChat, toMessage } from './firestoreMappers';

const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6, toMillis: () => ms });

describe('firestoreMappers', () => {
  it('xabar vaqtlarini millisekundga o\'giradi', () => {
    const m = toMessage('m1', { chatId: 'c1', content: 'salom', createdAt: ts(1_000), updatedAt: ts(2_000) });
    expect(m).toMatchObject({ id: 'm1', content: 'salom', createdAt: 1_000, updatedAt: 2_000 });
  });

  it('chat, lastMessage va ishtirokchi vaqtlarini o\'giradi', () => {
    const c = toChat('c1', {
      name: 'Test',
      createdAt: ts(1_000),
      updatedAt: ts(3_000),
      lastMessage: { content: 'hi', senderId: 'u1', createdAt: 2_000 },
      participantDetails: { u1: { uid: 'u1', lastSeen: ts(500) } },
    });
    expect(c.createdAt).toBe(1_000);
    expect(c.updatedAt).toBe(3_000);
    expect(c.lastMessage?.createdAt).toBe(2_000);
    expect(c.participantDetails.u1.lastSeen).toBe(500);
  });
});
