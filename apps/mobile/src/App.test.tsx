import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { App } from './App';
import { CHAT_ID, ME, PEER, directChat, member, message } from './test/fixtures';
import { createFakeServices } from './test/fakeServices';

describe('App', () => {
  it('kirish → chatlar ro\'yxati → chat: real vaqt xabar, "yozmoqda", o\'qildi', async () => {
    const chat = directChat({ lastMessage: message(1), unreadCount: 1 });
    const fake = createFakeServices({
      listChats:    jest.fn(async () => [chat]),
      listMessages: jest.fn(async () => ({ items: [message(1)], nextCursor: null })),
    });
    await render(<App services={fake.services} />);

    // Sessiya yo'q — kirish ekrani.
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'Ali@Example.uz');
    await fireEvent.changeText(screen.getByLabelText('Parol'), 'parol1234');
    await fireEvent.press(screen.getByText('Kirish'));
    await waitFor(() => expect(fake.api.login).toHaveBeenCalledWith({ email: 'ali@example.uz', password: 'parol1234' }));

    // Chatlar ro'yxati: suhbatdosh ismi, oxirgi xabar, o'qilmaganlar.
    expect(await screen.findByText(PEER.displayName)).toBeTruthy();
    expect(screen.getByText('xabar 1')).toBeTruthy();
    expect(screen.getByLabelText('1 ta o\'qilmagan')).toBeTruthy();
    expect(fake.socket.connect).toHaveBeenCalled();

    await fireEvent.press(screen.getByText(PEER.displayName));
    expect(await screen.findByText('xabar 1')).toBeTruthy();
    // Ochilganda oxirgi begona xabar o'qildi deb belgilanadi.
    await waitFor(() => expect(fake.socket.markRead).toHaveBeenCalledWith(CHAT_ID, message(1).id));

    // Suhbatdosh yozmoqda → sarlavhada.
    await act(() => fake.emit('typing', { chatId: CHAT_ID, userId: PEER.id, isTyping: true }));
    expect(screen.getByText('yozmoqda...')).toBeTruthy();

    // Real vaqt xabar.
    await act(() => fake.emit('message:new', { message: message(2) }));
    expect(screen.getByText('xabar 2')).toBeTruthy();
    expect(screen.queryByText('yozmoqda...')).toBeNull();
  });

  it('yuborish: optimistik → ack; suhbatdosh o\'qisa ✓✓', async () => {
    const sent = message(5, ME.id);
    const fake = createFakeServices({
      hasSession:   jest.fn(async () => true),
      listChats:    jest.fn(async () => [directChat()]),
    });
    (fake.socket.sendMessage as jest.Mock).mockResolvedValue({ ...sent, content: 'salom' });
    await render(<App services={fake.services} />);

    await fireEvent.press(await screen.findByText(PEER.displayName));
    await fireEvent.changeText(await screen.findByLabelText('Xabar matni'), '  salom ');
    expect(fake.socket.setTyping).toHaveBeenCalledWith(CHAT_ID, true);
    await fireEvent.press(screen.getByLabelText('Yuborish'));

    await waitFor(() => expect(fake.socket.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: CHAT_ID, content: 'salom' }),
    ));
    expect(fake.socket.setTyping).toHaveBeenCalledWith(CHAT_ID, false);
    expect(await screen.findByText(/✓$/)).toBeTruthy();

    await act(() => fake.emit('message:read', { chatId: CHAT_ID, userId: PEER.id, lastReadAt: sent.createdAt }));
    expect(screen.getByText(/✓✓$/)).toBeTruthy();
  });

  it('kanalda oddiy a\'zo yoza olmaydi', async () => {
    const channel = directChat({ type: 'channel', title: 'Yangiliklar', members: [member(ME)], memberCount: 120 });
    const fake = createFakeServices({ hasSession: jest.fn(async () => true), listChats: jest.fn(async () => [channel]) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Yangiliklar'));
    expect(await screen.findByText('Bu kanalda faqat adminlar yozadi')).toBeTruthy();
    expect(screen.getByText('120 obunachi')).toBeTruthy();
    expect(screen.queryByLabelText('Xabar matni')).toBeNull();
  });
});
