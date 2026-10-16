import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Message } from '@suhbat/core';
import { App } from '../../App';
import { CHAT_ID, ME, PEER, directChat, message } from '../../test/fixtures';
import { createFakeServices } from '../../test/fakeServices';

const at = (n: number, senderId = PEER.id): Message => ({
  ...message(n, senderId), createdAt: new Date(Date.now() - (10 - n) * 1_000).toISOString(),
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

describe('Javob berish (mobil)', () => {
  it('menyudan "Javob berish" → panel → yuborishda replyToId; pufakda javob bloki', async () => {
    const original = at(1);
    const fake = await open([original]);
    (fake.socket.sendMessage as jest.Mock).mockImplementation(async (p: { content: string; replyToId?: string }) => ({
      ...at(5, ME.id), content: p.content,
      replyTo: { id: original.id, senderId: PEER.id, content: original.content, kind: null, deleted: false },
    }));

    await fireEvent(screen.getByText('xabar 1'), 'longPress');
    await fireEvent.press(screen.getByText('Javob berish'));
    expect(screen.getByText('Javob: Vali')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Xabar matni'), 'ha, albatta');
    await fireEvent.press(screen.getByLabelText('Yuborish'));
    await waitFor(() => expect(fake.socket.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: CHAT_ID, content: 'ha, albatta', replyToId: original.id }),
    ));
    // Panel yopiladi, yangi xabarda javob bloki (muallif va asl matn)
    expect(screen.queryByLabelText('Javobni bekor qilish')).toBeNull();
    expect(await screen.findByText('ha, albatta')).toBeTruthy();
    expect(screen.getByLabelText('Javob: Vali: xabar 1')).toBeTruthy();
  });

  it('panelni bekor qilish — oddiy xabar ketadi', async () => {
    const fake = await open([at(1)]);
    (fake.socket.sendMessage as jest.Mock).mockResolvedValue({ ...at(5, ME.id), content: 'oddiy' });
    await fireEvent(screen.getByText('xabar 1'), 'longPress');
    await fireEvent.press(screen.getByText('Javob berish'));
    await fireEvent.press(screen.getByLabelText('Javobni bekor qilish'));
    await fireEvent.changeText(screen.getByLabelText('Xabar matni'), 'oddiy');
    await fireEvent.press(screen.getByLabelText('Yuborish'));
    await waitFor(() => expect(fake.socket.sendMessage).toHaveBeenCalled());
    expect((fake.socket.sendMessage as jest.Mock).mock.calls[0][0]).not.toHaveProperty('replyToId');
  });

  it('asl xabar o\'chirilsa — "O\'chirilgan xabar"; yuklanmagan xabarga o\'tish — izoh', async () => {
    const original = at(1);
    const reply: Message = {
      ...at(2, ME.id), content: 'javobim',
      replyTo: { id: original.id, senderId: PEER.id, content: original.content, kind: null, deleted: false },
    };
    const orphan: Message = {
      ...at(3, ME.id), content: 'eski javob',
      replyTo: { id: '00000000-0000-4000-8000-0000000000ff', senderId: PEER.id, content: 'juda eski', kind: null, deleted: false },
    };
    const fake = await open([original, reply, orphan]);

    await fireEvent.press(screen.getByLabelText('Javob: Vali: juda eski'));
    expect(await screen.findByText('Asl xabar hali yuklanmagan — yuqoriga suring.')).toBeTruthy();

    await act(() => fake.emit('message:deleted', { chatId: CHAT_ID, messageId: original.id, deletedAt: new Date().toISOString() }));
    expect(screen.getByText('O\'chirilgan xabar')).toBeTruthy();
    expect(screen.queryByText('xabar 1')).toBeNull();
  });
});
