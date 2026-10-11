import { describe, expect, it } from 'vitest';
import type { ChatSummary } from '@suhbat/core';
import { toAppUser, toChat, toMessage, withStatus } from './apiMappers';

const me = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const user = (id: string, displayName: string) => ({
  id, email: `${displayName}@test.uz`, displayName, photoUrl: null, createdAt: '2026-10-11T10:00:00.000Z',
});
const apiMsg = (overrides = {}) => ({
  id: '00000000-0000-4000-8000-0000000000m1', chatId: '00000000-0000-4000-8000-0000000000c1',
  senderId: me, type: 'text' as const, content: 'salom', attachment: null, createdAt: '2026-10-11T10:00:05.000Z', editedAt: null,
  ...overrides,
});
const summary: ChatSummary = {
  id: '00000000-0000-4000-8000-0000000000c1', type: 'direct', title: null, description: null, isPublic: false, memberCount: 2,
  createdAt: '2026-10-11T10:00:00.000Z', updatedAt: '2026-10-11T10:00:05.000Z',
  members: [
    { user: user(me, 'Ali'), role: 'member', lastReadAt: '2026-10-11T10:00:05.000Z', lastSeenAt: null },
    { user: user(other, 'Vali'), role: 'member', lastReadAt: null, lastSeenAt: '2026-10-11T09:00:00.000Z' },
  ],
  lastMessage: apiMsg(),
  unreadCount: 2,
};

describe('apiMappers', () => {
  it('toAppUser: id → uid, vaqt ms', () => {
    expect(toAppUser(user(me, 'Ali'))).toMatchObject({ uid: me, displayName: 'Ali', photoURL: null, createdAt: Date.parse('2026-10-11T10:00:00.000Z') });
  });

  it('toChat: 1:1 nomi — suhbatdosh ismi, a\'zolar va o\'qilgan vaqt', () => {
    const c = toChat(summary, me);
    expect(c.name).toBe('Vali');
    expect(c.participants).toEqual([me, other]);
    expect(c.participantDetails[other]).toMatchObject({ displayName: 'Vali', lastReadAt: null, lastSeen: Date.parse('2026-10-11T09:00:00.000Z') });
    expect(c.participantDetails[me].lastReadAt).toBe(Date.parse('2026-10-11T10:00:05.000Z'));
    expect(c.lastMessage).toEqual({ content: 'salom', senderId: me, createdAt: Date.parse('2026-10-11T10:00:05.000Z') });
    expect(c.unreadCount).toBe(2);
    expect(c.typingUsers).toEqual({});
  });

  it('toMessage: yuboruvchi ismi chatdan', () => {
    const chat = toChat(summary, me);
    expect(toMessage(apiMsg({ senderId: other }), chat)).toMatchObject({ senderName: 'Vali', status: 'sent', content: 'salom' });
    expect(toMessage(apiMsg(), null).senderName).toBe('');
  });

  it('toMessage: biriktirma va tahrirlangan vaqt', () => {
    const m = toMessage(apiMsg({
      type: 'voice', content: '', editedAt: '2026-10-11T10:01:00.000Z',
      attachment: { id: 'a1', kind: 'voice', name: 'ovoz.webm', mime: 'audio/webm', size: 10, durationMs: 4200, url: 'http://s3/x' },
    }), null);
    expect(m.attachment).toEqual({ id: 'a1', kind: 'voice', name: 'ovoz.webm', url: 'http://s3/x', type: 'audio/webm', size: 10, durationMs: 4200 });
    expect(m.editedAt).toBe(Date.parse('2026-10-11T10:01:00.000Z'));
    expect(toMessage(apiMsg(), null).editedAt).toBeNull();
  });

  it('toChat: guruh/kanal — rol, egasi, adminlar, a\'zolar soni, oxirgi xabar turi', () => {
    const group: ChatSummary = {
      ...summary, type: 'group', title: 'Do\'stlar', description: 'tavsif', isPublic: false, memberCount: 40,
      members: [
        { user: user(me, 'Ali'), role: 'admin', lastReadAt: null, lastSeenAt: null },
        { user: user(other, 'Vali'), role: 'owner', lastReadAt: null, lastSeenAt: null },
      ],
      lastMessage: apiMsg({ type: 'image', content: '' }),
    };
    const c = toChat(group, me);
    expect(c).toMatchObject({ name: 'Do\'stlar', description: 'tavsif', myRole: 'admin', ownerId: other, admins: [me], memberCount: 40 });
    expect(c.lastMessage?.content).toBe('Rasm');
  });

  it('withStatus: suhbatdosh o\'qigan bo\'lsa — read', () => {
    const chat = toChat(summary, me);
    const mine = toMessage(apiMsg(), chat);
    expect(withStatus(mine, chat, me).status).toBe('sent');

    chat.participantDetails[other].lastReadAt = mine.createdAt;
    expect(withStatus(mine, chat, me).status).toBe('read');
    // begona xabar va optimistik xabar o'zgarmaydi
    expect(withStatus({ ...mine, senderId: other }, chat, me).status).toBe('sent');
    expect(withStatus({ ...mine, status: 'sending' }, chat, me).status).toBe('sending');
  });
});
