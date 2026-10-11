import { describe, expect, it } from 'vitest';
import type { Chat, Message } from '../../types';
import reducer, { chatMessageReceived, memberRead, setChats, setTyping } from './chatsSlice';

const chat = (): Chat => ({
  id: 'c1', name: 'Vali', type: 'direct', photoURL: null, participants: ['me', 'v'],
  participantDetails: {
    me: { uid: 'me', displayName: 'Ali', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
    v:  { uid: 'v', displayName: 'Vali', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
  },
  lastMessage: null, unreadCount: 0, createdAt: 1, updatedAt: 1, typingUsers: {},
});
const msg = (senderId: string, createdAt: number): Message => ({
  id: `m${createdAt}`, chatId: 'c1', senderId, senderName: '', senderPhoto: null, content: 'hi',
  type: 'text', status: 'sent', createdAt, updatedAt: createdAt,
});

describe('chatsSlice', () => {
  const base = reducer(undefined, setChats([chat()]));

  it('begona xabar: lastMessage yangilanadi, unread +1, yozmoqda o\'chadi', () => {
    let s = reducer(base, setTyping({ chatId: 'c1', userId: 'v', isTyping: true }));
    s = reducer(s, chatMessageReceived({ message: msg('v', 10), currentUid: 'me', countUnread: true }));
    expect(s.chats[0].lastMessage).toEqual({ content: 'hi', senderId: 'v', createdAt: 10 });
    expect(s.chats[0].unreadCount).toBe(1);
    expect(s.chats[0].typingUsers).toEqual({});
  });

  it('o\'z xabari yoki ochiq chat — unread oshmaydi; eski xabar lastMessage\'ni bosmaydi', () => {
    let s = reducer(base, chatMessageReceived({ message: msg('me', 10), currentUid: 'me', countUnread: true }));
    s = reducer(s, chatMessageReceived({ message: msg('v', 11), currentUid: 'me', countUnread: false }));
    expect(s.chats[0].unreadCount).toBe(0);
    s = reducer(s, chatMessageReceived({ message: msg('v', 5), currentUid: 'me', countUnread: true }));
    expect(s.chats[0].lastMessage?.createdAt).toBe(11);
  });

  it('memberRead: lastReadAt faqat oldinga, o\'zim o\'qisam unread 0', () => {
    let s = reducer(base, chatMessageReceived({ message: msg('v', 10), currentUid: 'me', countUnread: true }));
    s = reducer(s, memberRead({ chatId: 'c1', userId: 'v', lastReadAt: 20, currentUid: 'me' }));
    s = reducer(s, memberRead({ chatId: 'c1', userId: 'v', lastReadAt: 15, currentUid: 'me' }));
    expect(s.chats[0].participantDetails.v.lastReadAt).toBe(20);
    expect(s.chats[0].unreadCount).toBe(1);
    s = reducer(s, memberRead({ chatId: 'c1', userId: 'me', lastReadAt: 10, currentUid: 'me' }));
    expect(s.chats[0].unreadCount).toBe(0);
  });

  it('setChats qayta yuklashda "yozmoqda" holatini saqlaydi', () => {
    let s = reducer(base, setTyping({ chatId: 'c1', userId: 'v', isTyping: true }));
    s = reducer(s, setChats([chat()]));
    expect(s.chats[0].typingUsers).toEqual({ v: true });
  });
});
