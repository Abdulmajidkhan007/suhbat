import { describe, expect, it } from 'vitest';
import { messageStatus } from './status.js';

const me = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const member = (id: string, lastReadAt: string | null) => ({ user: { id } as never, lastReadAt });

describe('messageStatus', () => {
  const msg = { senderId: me, createdAt: '2026-10-11T10:00:00.000Z' };

  it('boshqa a\'zo o\'qimagan bo\'lsa — sent', () => {
    expect(messageStatus(msg, [member(me, null), member(other, null)])).toBe('sent');
    expect(messageStatus(msg, [member(other, '2026-10-11T09:59:59.999Z')])).toBe('sent');
  });

  it('boshqa a\'zoning lastReadAt >= createdAt — read', () => {
    expect(messageStatus(msg, [member(other, '2026-10-11T10:00:00.000Z')])).toBe('read');
    expect(messageStatus(msg, [member(other, '2026-10-12T00:00:00.000Z')])).toBe('read');
  });

  it('yuboruvchining o\'z lastReadAt hisobga olinmaydi', () => {
    expect(messageStatus(msg, [member(me, '2026-10-12T00:00:00.000Z'), member(other, null)])).toBe('sent');
  });
});
