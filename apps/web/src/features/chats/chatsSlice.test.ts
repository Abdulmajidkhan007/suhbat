import { describe, expect, it } from 'vitest';
import type { Chat, Message } from '../../types';
import reducer, {
  chatMemberChanged,
  chatMessageReceived,
  chatUpdated,
  lastMessageEdited,
  memberRead,
  removeChat,
  setActiveChat,
  setChats,
  setTyping,
} from './chatsSlice';

const chat = (): Chat => ({
  id: 'c1', name: 'Vali', type: 'direct', photoURL: null, participants: ['me', 'v'], myRole: 'member',
  participantDetails: {
    me: { uid: 'me', displayName: 'Ali', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
    v:  { uid: 'v', displayName: 'Vali', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null },
  },
  lastMessage: null, unreadCount: 0, createdAt: 1, updatedAt: 1, typingUsers: {},
});
const msg = (senderId: string, createdAt: number): Message => ({
  id: `m${createdAt}`, chatId: 'c1', senderId, senderName: '', senderPhoto: null, content: 'hi',
  type: 'text', status: 'sent', createdAt, updatedAt: createdAt, editedAt: null,
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

  it('biriktirmali xabar: oxirgi xabar o\'rniga turi ko\'rsatiladi', () => {
    const s = reducer(base, chatMessageReceived({
      message: { ...msg('v', 10), type: 'voice', content: '' }, currentUid: 'me', countUnread: true,
    }));
    expect(s.chats[0].lastMessage?.content).toBe('Ovozli xabar');
  });

  it('lastMessageEdited: faqat shu xabar bo\'lsa matn yangilanadi', () => {
    let s = reducer(base, chatMessageReceived({ message: msg('v', 10), currentUid: 'me', countUnread: false }));
    s = reducer(s, lastMessageEdited({ chatId: 'c1', senderId: 'v', createdAt: 5, content: 'boshqa' }));
    expect(s.chats[0].lastMessage?.content).toBe('hi');
    s = reducer(s, lastMessageEdited({ chatId: 'c1', senderId: 'v', createdAt: 10, content: 'yangi' }));
    expect(s.chats[0].lastMessage?.content).toBe('yangi');
  });

  it('chatUpdated: nom, tavsif va ochiqlik', () => {
    const s = reducer(base, chatUpdated({ chatId: 'c1', title: 'Yangi', description: null, isPublic: true, updatedAt: 99 }));
    expect(s.chats[0]).toMatchObject({ name: 'Yangi', description: undefined, isPublic: true, updatedAt: 99 });
  });

  const third = { uid: 't', displayName: 'Tolib', photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null, role: 'member' as const };

  it('chatMemberChanged: qo\'shildi → a\'zo va soni; rol → adminlar va myRole; chiqdi → o\'chadi', () => {
    let s = reducer(base, chatMemberChanged({ chatId: 'c1', userId: 't', action: 'added', participant: third, memberCount: 3, currentUid: 'me' }));
    expect(s.chats[0]).toMatchObject({ participants: ['me', 'v', 't'], memberCount: 3 });
    s = reducer(s, chatMemberChanged({ chatId: 'c1', userId: 't', action: 'role', participant: { ...third, role: 'admin' }, memberCount: 3, currentUid: 'me' }));
    expect(s.chats[0].admins).toEqual(['t']);
    s = reducer(s, chatMemberChanged({
      chatId: 'c1', userId: 'me', action: 'role', participant: { ...base.chats[0].participantDetails.me, role: 'admin' }, memberCount: 3, currentUid: 'me',
    }));
    expect(s.chats[0].myRole).toBe('admin');
    s = reducer(s, chatMemberChanged({ chatId: 'c1', userId: 't', action: 'removed', participant: null, memberCount: 2, currentUid: 'me' }));
    expect(s.chats[0]).toMatchObject({ participants: ['me', 'v'], memberCount: 2 });
    expect(s.chats[0].participantDetails.t).toBeUndefined();
  });

  it('o\'zim chiqarilsam — chat ro\'yxatdan va faol chatdan o\'chadi; removeChat ham', () => {
    let s = reducer(base, setActiveChat('c1'));
    s = reducer(s, chatMemberChanged({ chatId: 'c1', userId: 'me', action: 'removed', participant: null, memberCount: 1, currentUid: 'me' }));
    expect(s.chats).toEqual([]);
    expect(s.activeChatId).toBeNull();
    s = reducer(reducer(base, setActiveChat('c1')), removeChat('c1'));
    expect(s.chats).toEqual([]);
    expect(s.activeChatId).toBeNull();
  });
});
