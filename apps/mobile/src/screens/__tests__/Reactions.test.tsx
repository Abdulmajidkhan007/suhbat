import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Message } from '@suhbat/core';
import { App } from '../../App';
import { CHAT_ID, ME, PEER, directChat, message } from '../../test/fixtures';
import { createFakeServices } from '../../test/fakeServices';

const at = (n: number, extra: Partial<Message> = {}): Message => ({
  ...message(n, PEER.id), createdAt: new Date(Date.now() - (10 - n) * 1_000).toISOString(), ...extra,
});

const open = async (items: Message[]) => {
  const fake = createFakeServices({
    hasSession:   jest.fn(async () => true),
    listChats:    jest.fn(async () => [directChat()]),
    listMessages: jest.fn(async () => ({ items, nextCursor: null })),
  });
  await render(<App services={fake.services} />);
  await fireEvent.press(await screen.findByText(PEER.displayName));
  await screen.findByLabelText('Xabar matni');
  return fake;
};

describe('Reaksiyalar (mobil)', () => {
  it('uzoq bosish → 6 emoji; tanlansa API chaqiriladi va xabar ostida son ko\'rinadi', async () => {
    const fake = await open([at(1)]);
    (fake.api.setReaction as jest.Mock).mockResolvedValue({ reactions: [{ emoji: '🔥', count: 1 }], myReaction: '🔥' });

    await fireEvent(screen.getByText('xabar 1'), 'longPress');
    for (const e of ['👍', '❤️', '😂', '😮', '😢', '🔥']) expect(screen.getByLabelText(e)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('🔥'));

    await waitFor(() => expect(fake.api.setReaction).toHaveBeenCalledWith(CHAT_ID, message(1).id, '🔥'));
    expect(await screen.findByLabelText('🔥 reaksiya, 1 ta, sizniki')).toBeTruthy();
  });

  it('o\'zining reaksiyasi chipini bossa — olib tashlanadi (null)', async () => {
    const fake = await open([at(1, { reactions: [{ emoji: '👍', count: 2 }], myReaction: '👍' })]);
    (fake.api.setReaction as jest.Mock).mockResolvedValue({ reactions: [{ emoji: '👍', count: 1 }], myReaction: null });

    await fireEvent.press(screen.getByLabelText('👍 reaksiya, 2 ta, sizniki'));
    await waitFor(() => expect(fake.api.setReaction).toHaveBeenCalledWith(CHAT_ID, message(1).id, null));
    expect(await screen.findByLabelText('👍 reaksiya, 1 ta')).toBeTruthy();
  });

  it('boshqa chip bosilsa — almashtirish', async () => {
    const fake = await open([at(1, { reactions: [{ emoji: '👍', count: 1 }, { emoji: '❤️', count: 1 }], myReaction: '👍' })]);
    (fake.api.setReaction as jest.Mock).mockResolvedValue({ reactions: [{ emoji: '❤️', count: 2 }], myReaction: '❤️' });
    await fireEvent.press(screen.getByLabelText('❤️ reaksiya, 1 ta'));
    await waitFor(() => expect(fake.api.setReaction).toHaveBeenCalledWith(CHAT_ID, message(1).id, '❤️'));
  });

  it('xato — oldingi holatga qaytadi va izoh ko\'rsatiladi', async () => {
    const fake = await open([at(1, { reactions: [{ emoji: '👍', count: 1 }], myReaction: null })]);
    (fake.api.setReaction as jest.Mock).mockRejectedValue(new Error('tarmoq'));
    await fireEvent.press(screen.getByLabelText('👍 reaksiya, 1 ta'));
    expect(await screen.findByText('Reaksiyani saqlab bo\'lmadi.')).toBeTruthy();
    expect(screen.getByLabelText('👍 reaksiya, 1 ta')).toBeTruthy();
  });

  it('real vaqt: boshqa a\'zo reaksiyasi hisobni yangilaydi; o\'z boshqa qurilmam — myReaction ham', async () => {
    const fake = await open([at(1)]);
    await act(async () => {
      fake.emit('message:reaction', { chatId: CHAT_ID, messageId: message(1).id, userId: PEER.id, emoji: '😂', reactions: [{ emoji: '😂', count: 1 }] });
    });
    expect(await screen.findByLabelText('😂 reaksiya, 1 ta')).toBeTruthy();

    await act(async () => {
      fake.emit('message:reaction', {
        chatId: CHAT_ID, messageId: message(1).id, userId: ME.id, emoji: '😂', reactions: [{ emoji: '😂', count: 2 }],
      });
    });
    expect(await screen.findByLabelText('😂 reaksiya, 2 ta, sizniki')).toBeTruthy();
  });
});
