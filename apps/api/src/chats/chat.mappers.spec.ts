import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './chat.mappers';
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
