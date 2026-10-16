import Clipboard from '@react-native-clipboard/clipboard';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { App } from '../../App';
import { CHAT_ID, ME, PEER, directChat, message } from '../../test/fixtures';
import { createFakeServices } from '../../test/fakeServices';

const now = (n: number, senderId = PEER.id) => ({ ...message(n, senderId), createdAt: new Date(Date.now() - (10 - n) * 1_000).toISOString() });

const openChat = async (items = [now(1), now(2, ME.id)]) => {
  const fake = createFakeServices({
    hasSession:   jest.fn(async () => true),
    listChats:    jest.fn(async () => [directChat({ lastMessage: items[items.length - 1] ?? null })]),
    listMessages: jest.fn(async () => ({ items, nextCursor: null })),
  });
  await render(<App services={fake.services} />);
  await fireEvent.press(await screen.findByText(PEER.displayName));
  await screen.findByLabelText('Xabar matni');
  return fake;
};

describe('Chat ekrani', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ro\'yxat qatori: "Siz:" prefiksi, holat belgisi, 24 soatlik vaqt', async () => {
    const own = now(2, ME.id);
    const fake = createFakeServices({
      hasSession: jest.fn(async () => true),
      listChats:  jest.fn(async () => [directChat({ lastMessage: own })]),
    });
    await render(<App services={fake.services} />);
    expect(await screen.findByText('Siz: ')).toBeTruthy();
    expect(screen.getByLabelText('yuborildi')).toBeTruthy();
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
  });

  it('sana ajratgichi va bo\'sh chat holati', async () => {
    await openChat();
    expect(screen.getByText('Bugun')).toBeTruthy();
  });

  it('bo\'sh chat — taklif matni', async () => {
    await openChat([]);
    expect(await screen.findByText('Hali xabar yo\'q. Birinchi bo\'lib yozing!')).toBeTruthy();
  });

  it('uzun bosish: nusxa olish', async () => {
    await openChat();
    await fireEvent(screen.getByText('xabar 1'), 'longPress');
    expect(screen.getByText('Xabar amallari')).toBeTruthy();
    // Begona xabar — tahrirlab bo'lmaydi, lekin 1:1 da o'chirish ham yo'q.
    expect(screen.queryByText('Tahrirlash')).toBeNull();
    expect(screen.queryByText('O\'chirish')).toBeNull();
    await fireEvent.press(screen.getByText('Nusxa olish'));
    expect(Clipboard.setString).toHaveBeenCalledWith('xabar 1');
    expect(await screen.findByText('Nusxa olindi')).toBeTruthy();
  });

  it('uzun bosish: o\'z xabarini tahrirlash', async () => {
    const fake = await openChat();
    const original = now(2, ME.id);
    (fake.socket.editMessage as jest.Mock).mockResolvedValue({ ...original, content: 'tuzatildi', editedAt: new Date().toISOString() });

    await fireEvent(screen.getByText('xabar 2'), 'longPress');
    await fireEvent.press(screen.getByText('Tahrirlash'));
    expect(screen.getByText('Tahrirlash')).toBeTruthy(); // composer ustidagi panel
    const input = screen.getByLabelText('Xabar matni');
    expect(input.props.value).toBe('xabar 2');
    // O'zgarmagan matn — saqlash o'chiq.
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();

    await fireEvent.changeText(input, 'tuzatildi');
    await fireEvent.press(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(fake.socket.editMessage).toHaveBeenCalledWith(CHAT_ID, original.id, 'tuzatildi'));
    expect(await screen.findByText('tuzatildi')).toBeTruthy();
    expect(screen.getAllByText('tahrirlangan').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Xabar matni').props.value).toBe('');
  });

  it('uzun bosish: o\'chirish tasdiq bilan', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const fake = await openChat();
    await fireEvent(screen.getByText('xabar 2'), 'longPress');
    await fireEvent.press(screen.getByText('O\'chirish'));
    expect(alert).toHaveBeenCalledWith('Xabarni o\'chirish', expect.any(String), expect.any(Array));
    await waitFor(() => expect(fake.socket.deleteMessage).toHaveBeenCalledWith(CHAT_ID, now(2, ME.id).id));
    await waitFor(() => expect(screen.queryByText('xabar 2')).toBeNull());
  });

  it('xabarlarni yuklab bo\'lmasa — xato va "Qayta urinish"', async () => {
    const listMessages = jest.fn()
      .mockRejectedValueOnce(new Error('tarmoq'))
      .mockResolvedValue({ items: [now(1)], nextCursor: null });
    const fake = createFakeServices({
      hasSession: jest.fn(async () => true),
      listChats:  jest.fn(async () => [directChat()]),
      listMessages,
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText(PEER.displayName));
    expect(await screen.findByText('Xabarlarni yuklab bo\'lmadi.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Qayta urinish'));
    expect(await screen.findByText('xabar 1')).toBeTruthy();
  });

  it('aloqa uzilsa — "Ulanmoqda…", tiklansa yo\'qoladi', async () => {
    const fake = await openChat();
    await act(() => fake.setConnected(false));
    expect(await screen.findByText('Ulanmoqda…', {}, { timeout: 4000 })).toBeTruthy();
    await act(() => fake.setConnected(true));
    expect(screen.queryByText('Ulanmoqda…')).toBeNull();
  });
});
