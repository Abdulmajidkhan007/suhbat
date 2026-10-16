import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ChatSummary } from '@suhbat/core';
import { App } from '../App';
import { parsePushData } from '../services/push';
import { createFakePush } from '../test/fakePush';
import { createFakeServices } from '../test/fakeServices';
import { CHAT_ID, PEER, directChat, message } from '../test/fixtures';

const OTHER_CHAT = '00000000-0000-4000-8000-0000000000c2';
const data = (chatId = CHAT_ID) => ({ type: 'message' as const, chatId, messageId: message(9, PEER.id, chatId).id });

const setup = (fake: ReturnType<typeof createFakePush>, chats: ChatSummary[] = [directChat()]) => {
  const services = createFakeServices(
    {
      hasSession: jest.fn(async () => true),
      listChats:  jest.fn(async () => chats),
      getChat:    jest.fn(async (id: string) => chats.find((c) => c.id === id) ?? chats[0]!),
    },
    fake.push,
  );
  return services;
};

describe('parsePushData', () => {
  it('faqat to\'g\'ri formatdagi data', () => {
    expect(parsePushData({ data: data() })).toEqual(data());
    expect(parsePushData({ data: { type: 'message', chatId: 'x' } })).toBeNull();
    expect(parsePushData({})).toBeNull();
    expect(parsePushData(null)).toBeNull();
  });
});

describe('PushNotifications', () => {
  it('ruxsat → token serverga; onTokenRefresh da qayta yoziladi', async () => {
    const fake = createFakePush({ token: 'tok-a' });
    const { services, api } = setup(fake);
    await render(<App services={services} />);
    await waitFor(() => expect(api.registerDevice).toHaveBeenCalledWith({ platform: 'android', token: 'tok-a' }));
    expect(fake.push.requestPermission).toHaveBeenCalled();
    await act(() => fake.refresh('tok-b'));
    expect(api.registerDevice).toHaveBeenLastCalledWith({ platform: 'android', token: 'tok-b' });
  });

  it('ruxsat berilmasa token yuborilmaydi', async () => {
    const fake = createFakePush({ granted: false });
    const { services, api } = setup(fake);
    await render(<App services={services} />);
    await waitFor(() => expect(fake.push.requestPermission).toHaveBeenCalled());
    expect(fake.push.getToken).not.toHaveBeenCalled();
    expect(api.registerDevice).not.toHaveBeenCalled();
  });

  it('foreground: banner, bosilganda chat ochiladi; shu chat ochiq bo\'lsa banner yo\'q', async () => {
    const fake = createFakePush();
    const { services } = setup(fake);
    await render(<App services={services} />);
    await screen.findByText(PEER.displayName);

    await act(() => fake.foreground({ title: 'Vali', body: 'salom!', data: data() }));
    expect(screen.getByText('salom!')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Yangi xabar: Vali'));
    expect(await screen.findByLabelText('Xabar matni')).toBeTruthy();
    expect(screen.queryByText('salom!')).toBeNull();

    // Shu chat ochiq — banner chiqmaydi
    await act(() => fake.foreground({ title: 'Vali', body: 'yana', data: data() }));
    expect(screen.queryByText('yana')).toBeNull();
  });

  it('banner "Yopish" bilan yopiladi', async () => {
    const fake = createFakePush();
    const { services } = setup(fake);
    await render(<App services={services} />);
    await screen.findByText(PEER.displayName);
    await act(() => fake.foreground({ title: 'Guruh', body: 'ikki', data: data(OTHER_CHAT) }));
    expect(screen.getByText('ikki')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Yopish'));
    expect(screen.queryByText('ikki')).toBeNull();
  });

  it('bildirishnoma bosildi (fon / yopiq holat) → shu chat ochiladi', async () => {
    const fake = createFakePush({ initial: data() });
    const { services } = setup(fake);
    await render(<App services={services} />);
    expect(await screen.findByLabelText('Xabar matni')).toBeTruthy();
    expect(fake.push.getInitialNotification).toHaveBeenCalledTimes(1);

    const fake2 = createFakePush();
    await render(<App services={setup(fake2).services} />);
    await screen.findByText(PEER.displayName);
    await act(() => fake2.open(data()));
    expect(await screen.findByLabelText('Xabar matni')).toBeTruthy();
  });

  it('logout: deviceToken serverga beriladi va FCM tokeni o\'chiriladi', async () => {
    const fake = createFakePush({ token: 'tok-out' });
    const { services, api } = setup(fake);
    await render(<App services={services} />);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(await screen.findByRole('tab', { name: 'Sozlamalar' }));
    await fireEvent.press(await screen.findByText('Chiqish'));
    expect(alert).toHaveBeenCalledWith('Chiqish', 'Hisobdan chiqmoqchimisiz?', expect.any(Array));
    alert.mockRestore();
    await waitFor(() => expect(api.logout).toHaveBeenCalledWith({ deviceToken: 'tok-out' }));
    expect(fake.push.deleteToken).toHaveBeenCalled();
  });
});
