import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { PublicChannel, PublicUser } from '@suhbat/core';
import { App } from './App';
import { CHAT_ID, ME, PEER, directChat } from './test/fixtures';
import { createFakeServices } from './test/fakeServices';

const FOUND: PublicUser = { id: '00000000-0000-4000-8000-0000000000a1', displayName: 'Test Odam', photoUrl: null, bio: 'Salom', createdAt: ME.createdAt };
const CHANNEL: PublicChannel = {
  id: '00000000-0000-4000-8000-0000000000b1', title: 'Test kanal', description: 'Sinov', memberCount: 12, isMember: false,
};

const signedIn = (api: Parameters<typeof createFakeServices>[0] = {}) =>
  createFakeServices({ hasSession: jest.fn(async () => true), listChats: jest.fn(async () => [directChat()]), ...api });

describe('Global qidiruv (mobil)', () => {
  it('"Test": foydalanuvchilar va ochiq kanallar bo\'limlari; mavjud suhbat bo\'lmasa ham', async () => {
    const fake = signedIn({
      searchUsers:          jest.fn(async () => [FOUND]),
      searchPublicChannels: jest.fn(async () => [CHANNEL]),
    });
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), 'Test');

    expect(await screen.findByText('Test Odam')).toBeTruthy();
    expect(screen.getByText('Test kanal')).toBeTruthy();
    expect(screen.getByText('Foydalanuvchilar')).toBeTruthy();
    expect(screen.getByText('Ochiq kanallar')).toBeTruthy();
    expect(screen.queryByText('Topilmadi')).toBeNull();
    expect(fake.api.searchUsers).toHaveBeenCalledWith('Test');
    expect(fake.api.searchPublicChannels).toHaveBeenCalledWith('Test');
  });

  it('foydalanuvchini bosish — 1:1 chat yaratilib ochiladi', async () => {
    const chat = directChat();
    const fake = signedIn({
      searchUsers:      jest.fn(async () => [FOUND]),
      createDirectChat: jest.fn(async () => chat),
    });
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), 'Test');
    await fireEvent.press(await screen.findByText('Test Odam'));

    await waitFor(() => expect(fake.api.createDirectChat).toHaveBeenCalledWith(FOUND.id));
    expect(await screen.findByLabelText('Xabar matni')).toBeTruthy();
    expect(chat.id).toBe(CHAT_ID);
  });

  it('kanalni bosish — "Obuna bo\'lish" tasdig\'i, obuna bo\'lgach kanal ochiladi', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const joined = { ...directChat(), id: CHANNEL.id, type: 'channel' as const, title: CHANNEL.title };
    const fake = signedIn({
      searchPublicChannels: jest.fn(async () => [CHANNEL]),
      joinChannel:          jest.fn(async () => joined),
    });
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), 'Test');
    await fireEvent.press(await screen.findByText('Test kanal'));

    expect(alert).toHaveBeenCalledWith('Test kanal', '12 obunachi\n\nSinov', expect.any(Array));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Yopish', 'Obuna bo\'lish']);
    await act(async () => { buttons[1]?.onPress?.(); });
    await waitFor(() => expect(fake.api.joinChannel).toHaveBeenCalledWith(CHANNEL.id));
    alert.mockRestore();
  });

  it('xatoda bo\'lim xabari va qayta urinish', async () => {
    const fake = signedIn({
      searchUsers:          jest.fn().mockRejectedValueOnce(new Error('tarmoq')).mockResolvedValue([FOUND]),
      searchPublicChannels: jest.fn(async () => []),
    });
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), 'Test');
    expect(await screen.findByText('Foydalanuvchilarni qidirib bo\'lmadi.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Qayta urinish'));
    expect(await screen.findByText('Test Odam')).toBeTruthy();
  });

  it('hech narsa topilmasa — "Topilmadi"', async () => {
    const fake = signedIn();
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), 'zzz');
    expect(await screen.findByText('Topilmadi')).toBeTruthy();
  });

  it('mavjud suhbat nomi bo\'yicha ham topiladi', async () => {
    const fake = signedIn();
    await render(<App services={fake.services} />);
    await fireEvent.changeText(await screen.findByLabelText('Qidirish'), PEER.displayName.slice(0, 3));
    expect(await screen.findByText('Suhbatlar')).toBeTruthy();
    expect(screen.getByText(PEER.displayName)).toBeTruthy();
  });
});

describe('Profil (mobil)', () => {
  it('ism va bio saqlanadi; o\'zgarish yo\'q yoki ism bo\'sh bo\'lsa — tugma o\'chiq', async () => {
    const updated = { ...ME, displayName: 'Ali Yangi', bio: 'Dasturchi' };
    const fake = signedIn({ updateProfile: jest.fn(async () => updated) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Profil'));

    const save = await screen.findByText('Saqlash');
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Ism'), '  ');
    expect(screen.getByText('Ism bo\'sh bo\'lmasin')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Ism'), ' Ali Yangi ');
    await fireEvent.changeText(screen.getByLabelText('Men haqimda'), 'Dasturchi');
    await fireEvent.press(save);

    await waitFor(() => expect(fake.api.updateProfile).toHaveBeenCalledWith({ displayName: 'Ali Yangi', bio: 'Dasturchi' }));
    expect(await screen.findByText('Profil saqlandi')).toBeTruthy();
  });

  it('server xatosi — xabar ko\'rsatiladi', async () => {
    const fake = signedIn({ updateProfile: jest.fn(async () => { throw new Error('500'); }) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByText('Profil'));
    await fireEvent.changeText(await screen.findByLabelText('Ism'), 'Yangi ism');
    await fireEvent.press(screen.getByText('Saqlash'));
    expect(await screen.findByText('Profilni saqlab bo\'lmadi. Qayta urinib ko\'ring.')).toBeTruthy();
  });
});
