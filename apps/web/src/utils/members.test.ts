import { describe, expect, it } from 'vitest';
import type { ChatParticipant } from '../types';
import { listedMembers, subscriberCount } from './members';

const p = (uid: string, role?: ChatParticipant['role']): ChatParticipant => ({
  uid, displayName: uid, photoURL: null, isOnline: false, lastSeen: 0, role,
});

describe('listedMembers', () => {
  const members = [p('ega', 'owner'), p('admin', 'admin'), p('obunachi', 'member'), p('rolsiz')];

  it('kanalda faqat ega va adminlar (oddiy obunachi — "Owner" ismli ham — yo\'q)', () => {
    expect(listedMembers('channel', members).map((m) => m.uid)).toEqual(['ega', 'admin']);
  });

  it('guruhda hamma a\'zo', () => {
    expect(listedMembers('group', members)).toHaveLength(4);
  });
});

describe('subscriberCount', () => {
  it('jami a\'zolardan ega va adminlar ayriladi', () => {
    expect(subscriberCount(10, [p('ega', 'owner'), p('admin', 'admin'), p('men', 'member')])).toBe(8);
  });

  it('manfiy bo\'lmaydi', () => {
    expect(subscriberCount(1, [p('a', 'owner'), p('b', 'admin')])).toBe(0);
  });
});
