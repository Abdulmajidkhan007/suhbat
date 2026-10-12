import { CHAT_ID, ME, PEER, directChat, message } from '../test/fixtures';
import { chatReducer, initialChatState, sortedChats } from './chatState';
import type { ChatState, LocalMessage } from './chatState';

const withChat = (): ChatState => chatReducer(initialChatState, { type: 'chats/loaded', chats: [directChat()] });

const loaded = (items = [message(1), message(2)], nextCursor: string | null = 'c1'): ChatState =>
  chatReducer(withChat(), { type: 'messages/loaded', chatId: CHAT_ID, page: { items, nextCursor }, older: false });

describe('chatReducer', () => {
  it('eski sahifa boshiga qo\'shiladi, tartib xronologik, dublikat yo\'q', () => {
    const s = chatReducer(loaded([message(3), message(4)]), {
      type: 'messages/loaded', chatId: CHAT_ID, page: { items: [message(1), message(2), message(3)], nextCursor: null }, older: true,
    });
    expect(s.messages[CHAT_ID]?.items.map((m) => m.content)).toEqual(['xabar 1', 'xabar 2', 'xabar 3', 'xabar 4']);
    expect(s.messages[CHAT_ID]?.nextCursor).toBeNull();
  });

  it('optimistik xabar server javobi (clientId) bilan almashtiriladi', () => {
    const optimistic: LocalMessage = { ...message(9, ME.id), id: 'local:x', clientId: 'x', local: 'pending' };
    let s = chatReducer(loaded(), { type: 'message/optimistic', message: optimistic });
    expect(s.messages[CHAT_ID]?.items).toHaveLength(3);
    const saved = message(9, ME.id);
    s = chatReducer(s, { type: 'message/received', message: saved, clientId: 'x', myId: ME.id, activeChatId: CHAT_ID });
    const items = s.messages[CHAT_ID]?.items ?? [];
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual(saved);
    expect(s.chats[CHAT_ID]?.lastMessage).toEqual(saved);
    expect(s.chats[CHAT_ID]?.unreadCount).toBe(0);
  });

  it('yuborish xatosi — failed, qayta urinish — pending', () => {
    const optimistic: LocalMessage = { ...message(9, ME.id), id: 'local:x', clientId: 'x', local: 'pending' };
    let s = chatReducer(loaded(), { type: 'message/optimistic', message: optimistic });
    s = chatReducer(s, { type: 'message/local', chatId: CHAT_ID, clientId: 'x', local: 'failed' });
    expect(s.messages[CHAT_ID]?.items[2]?.local).toBe('failed');
    s = chatReducer(s, { type: 'message/local', chatId: CHAT_ID, clientId: 'x', local: 'pending' });
    expect(s.messages[CHAT_ID]?.items[2]?.local).toBe('pending');
  });

  it('boshqa chatdagi begona xabar o\'qilmaganlarni oshiradi, ochiq chatda — yo\'q, takror kelsa — yo\'q', () => {
    let s = loaded();
    s = chatReducer(s, { type: 'message/received', message: message(5), myId: ME.id, activeChatId: null });
    s = chatReducer(s, { type: 'message/received', message: message(5), myId: ME.id, activeChatId: null });
    expect(s.chats[CHAT_ID]?.unreadCount).toBe(1);
    s = chatReducer(s, { type: 'message/received', message: message(6), myId: ME.id, activeChatId: CHAT_ID });
    expect(s.chats[CHAT_ID]?.unreadCount).toBe(1);
  });

  it('xabar kelganda yuboruvchining "yozmoqda" holati o\'chadi', () => {
    let s = chatReducer(loaded(), { type: 'typing', chatId: CHAT_ID, userId: PEER.id, isTyping: true });
    expect(s.typing[CHAT_ID]).toEqual([PEER.id]);
    s = chatReducer(s, { type: 'message/received', message: message(7), myId: ME.id, activeChatId: CHAT_ID });
    expect(s.typing[CHAT_ID]).toEqual([]);
  });

  it('o\'zim o\'qiganda unread qayta hisoblanadi; suhbatdosh o\'qisa lastReadAt yangilanadi', () => {
    let s = chatReducer(loaded(), { type: 'chat/upserted', chat: directChat({ unreadCount: 2 }) });
    s = chatReducer(s, { type: 'messages/loaded', chatId: CHAT_ID, page: { items: [message(1), message(2)], nextCursor: null }, older: false });
    s = chatReducer(s, { type: 'read/updated', chatId: CHAT_ID, userId: ME.id, lastReadAt: message(1).createdAt, myId: ME.id });
    expect(s.chats[CHAT_ID]?.unreadCount).toBe(1);
    s = chatReducer(s, { type: 'read/updated', chatId: CHAT_ID, userId: PEER.id, lastReadAt: message(2).createdAt, myId: ME.id });
    expect(s.chats[CHAT_ID]?.members.find((m) => m.user.id === PEER.id)?.lastReadAt).toBe(message(2).createdAt);
  });

  it('presence: oflayn bo\'lganda lastSeenAt yoziladi', () => {
    let s = chatReducer(withChat(), { type: 'presence/state', online: [PEER.id] });
    expect(s.online[PEER.id]).toBe(true);
    s = chatReducer(s, { type: 'presence/update', userId: PEER.id, online: false, lastSeenAt: '2026-10-12T11:00:00.000Z' });
    expect(s.online[PEER.id]).toBe(false);
    expect(s.chats[CHAT_ID]?.members.find((m) => m.user.id === PEER.id)?.lastSeenAt).toBe('2026-10-12T11:00:00.000Z');
  });

  it('chat o\'chirilsa xabarlari ham ketadi; tahrir/o\'chirish', () => {
    let s = chatReducer(loaded(), { type: 'message/updated', message: { ...message(2), content: 'yangi', editedAt: '2026-10-12T12:00:00.000Z' } });
    expect(s.messages[CHAT_ID]?.items[1]?.content).toBe('yangi');
    s = chatReducer(s, { type: 'message/deleted', chatId: CHAT_ID, messageId: message(1).id });
    expect(s.messages[CHAT_ID]?.items).toHaveLength(1);
    s = chatReducer(s, { type: 'chat/removed', chatId: CHAT_ID });
    expect(s.chats[CHAT_ID]).toBeUndefined();
    expect(s.messages[CHAT_ID]).toBeUndefined();
  });

  it('sortedChats — oxirgi faollik bo\'yicha', () => {
    const other = directChat({ id: '00000000-0000-4000-8000-0000000000c2', lastMessage: message(30) });
    const s = chatReducer(initialChatState, { type: 'chats/loaded', chats: [directChat({ lastMessage: message(1) }), other] });
    expect(sortedChats(s).map((c) => c.id)).toEqual([other.id, CHAT_ID]);
  });
});
