import { describe, expect, it } from 'vitest';
import type { Message } from '../../types';
import reducer, {
  appendOptimisticMessage,
  messageDeleted,
  messageReceived,
  messageUpdated,
  prependOlder,
  setMessages,
} from './messagesSlice';

const msg = (id: string, createdAt: number, extra: Partial<Message> = {}): Message => ({
  id, chatId: 'c1', senderId: 'u1', senderName: 'Ali', senderPhoto: null, content: id,
  type: 'text', status: 'sent', createdAt, updatedAt: createdAt, editedAt: null, ...extra,
});
const ids = (s: ReturnType<typeof reducer>) => s.messagesByChatId.c1.map((m) => m.id);

describe('messagesSlice', () => {
  const loaded = reducer(undefined, setMessages({ chatId: 'c1', messages: [msg('a', 1), msg('b', 2)], nextCursor: 'cur' }));

  it('ack: optimistik xabar server xabari bilan almashadi, takrorlanmaydi', () => {
    let s = reducer(loaded, appendOptimisticMessage(msg('tmp', 3, { status: 'sending', isOptimistic: true })));
    s = reducer(s, messageReceived({ message: msg('c', 3), clientId: 'tmp' }));
    expect(ids(s)).toEqual(['a', 'b', 'c']);
    // o'sha xabar `message:new` orqali yana kelsa
    s = reducer(s, messageReceived({ message: msg('c', 3), clientId: 'tmp' }));
    expect(ids(s)).toEqual(['a', 'b', 'c']);
  });

  it('kechikib kelgan xabar vaqt bo\'yicha joyiga tushadi', () => {
    const s = reducer(loaded, messageReceived({ message: msg('x', 1.5) }));
    expect(ids(s)).toEqual(['a', 'x', 'b']);
  });

  it('ochilmagan chat uchun xabar saqlanmaydi', () => {
    const s = reducer(loaded, messageReceived({ message: { ...msg('z', 5), chatId: 'c2' } }));
    expect(s.messagesByChatId.c2).toBeUndefined();
  });

  it('prependOlder eskilarni boshiga qo\'shadi va kursorni yangilaydi', () => {
    const s = reducer(loaded, prependOlder({ chatId: 'c1', messages: [msg('y', 0), msg('a', 1)], nextCursor: null }));
    expect(ids(s)).toEqual(['y', 'a', 'b']);
    expect(s.nextCursorByChatId.c1).toBeNull();
  });

  it('qayta yuklashda yuborilayotgan optimistik xabar yo\'qolmaydi', () => {
    let s = reducer(loaded, appendOptimisticMessage(msg('tmp', 9, { status: 'sending', isOptimistic: true })));
    s = reducer(s, setMessages({ chatId: 'c1', messages: [msg('a', 1)], nextCursor: null }));
    expect(ids(s)).toEqual(['a', 'tmp']);
  });

  it('messageUpdated: matn va editedAt almashadi, holat saqlanadi', () => {
    const s = reducer(loaded, messageUpdated(msg('b', 2, { content: 'yangi', editedAt: 50, updatedAt: 50, status: 'sent' })));
    expect(s.messagesByChatId.c1[1]).toMatchObject({ id: 'b', content: 'yangi', editedAt: 50 });
    expect(ids(s)).toEqual(['a', 'b']);
    // noma'lum xabar yoki ochilmagan chat — hech narsa o'zgarmaydi
    expect(reducer(loaded, messageUpdated(msg('zzz', 2)))).toEqual(loaded);
    expect(reducer(loaded, messageUpdated({ ...msg('b', 2), chatId: 'c9' }))).toEqual(loaded);
  });

  it('messageDeleted: xabar ro\'yxatdan olib tashlanadi', () => {
    const s = reducer(loaded, messageDeleted({ chatId: 'c1', messageId: 'a' }));
    expect(ids(s)).toEqual(['b']);
    expect(reducer(loaded, messageDeleted({ chatId: 'c9', messageId: 'a' }))).toEqual(loaded);
  });
});
