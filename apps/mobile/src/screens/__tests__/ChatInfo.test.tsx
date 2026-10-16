import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ChatSummary, PublicUser } from '@suhbat/core';
import { App } from '../../App';
import { CHAT_ID, ME, PEER, directChat, member } from '../../test/fixtures';
import { createFakeServices } from '../../test/fakeServices';

const SARDOR: PublicUser = { ...PEER, id: '00000000-0000-4000-8000-0000000000a5', displayName: 'Sardor' };

const group = (overrides: Partial<ChatSummary> = {}): ChatSummary => directChat({
  type: 'group', title: 'Do\'stlar', description: 'Hafta oxiri rejalari',
  members: [{ ...member(ME), role: 'owner' }, member(PEER)], memberCount: 2, ...overrides,
});

const confirmAll = () => jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
  buttons?.find((b) => b.style === 'destructive')?.onPress?.();
});

const openInfo = async (chat: ChatSummary, api: Parameters<typeof createFakeServices>[0] = {}) => {
  const fake = createFakeServices({
    hasSession: jest.fn(async () => true),
    listChats:  jest.fn(async () => [chat]),
    getChat:    jest.fn(async () => chat),
    ...api,
  });
  await render(<App services={fake.services} />);
  await fireEvent.press(await screen.findByText(chat.title ?? PEER.displayName));
  await fireEvent.press(await screen.findByHintText('Suhbat ma\'lumotlari'));
  await screen.findByText('Ma\'lumot');
  return fake;
};

describe('Chat ma\'lumotlari', () => {
  afterEach(() => jest.restoreAllMocks());

  it('guruh: tavsif, a\'zolar va rollar; ega a\'zoni admin qiladi', async () => {
    const fake = await openInfo(group(), { setMemberRole: jest.fn(async () => ({ ...member(PEER), role: 'admin' as const })) });
    expect(screen.getByText('Hafta oxiri rejalari')).toBeTruthy();
    expect(screen.getByText('A\'zolar · 2')).toBeTruthy();
    expect(screen.getByText('ega')).toBeTruthy();
    expect(screen.getByText(`${ME.displayName} (Siz)`)).toBeTruthy();

    await fireEvent.press(screen.getByText(PEER.displayName));
    await fireEvent.press(screen.getByText('Admin qilish'));
    await waitFor(() => expect(fake.api.setMemberRole).toHaveBeenCalledWith(CHAT_ID, PEER.id, 'admin'));
  });

  it('a\'zoni chiqarib yuborish (tasdiq bilan)', async () => {
    confirmAll();
    const fake = await openInfo(group());
    await fireEvent.press(screen.getByText(PEER.displayName));
    await fireEvent.press(screen.getByText('Chiqarib yuborish'));
    await waitFor(() => expect(fake.api.removeMember).toHaveBeenCalledWith(CHAT_ID, PEER.id));
  });

  it('oddiy a\'zo: boshqaruv tugmalari yo\'q, "Guruhdan chiqish" ishlaydi', async () => {
    confirmAll();
    const chat = group({ members: [member(ME), { ...member(PEER), role: 'owner' }] });
    let left = false;
    const fake = await openInfo(chat, {
      listChats: jest.fn(async () => (left ? [] : [chat])),
      leaveChat: jest.fn(async () => {
        left = true;
      }),
    });
    expect(screen.queryByText('A\'zo qo\'shish')).toBeNull();
    expect(screen.queryByLabelText('Tahrirlash')).toBeNull();
    await fireEvent.press(screen.getByText('Guruhdan chiqish'));
    await waitFor(() => expect(fake.api.leaveChat).toHaveBeenCalledWith(CHAT_ID));
    // Ro'yxatga qaytadi va chat yo'qoladi.
    expect(await screen.findByText('Hali suhbat yo\'q')).toBeTruthy();
  });

  it('a\'zo qo\'shish: qidirish, tanlash, "Qo\'shish (1)"', async () => {
    const updated = group({ members: [...group().members, member(SARDOR)], memberCount: 3 });
    const fake = await openInfo(group(), {
      searchUsers: jest.fn(async () => [SARDOR, PEER]),
      addMembers:  jest.fn(async () => updated),
    });
    await fireEvent.press(screen.getByText('A\'zo qo\'shish'));
    await fireEvent.changeText(await screen.findByLabelText('Foydalanuvchi qidirish'), 'Sar');
    expect(await screen.findByText('Sardor')).toBeTruthy();
    expect(screen.getByText('allaqachon a\'zo')).toBeTruthy(); // PEER

    expect(screen.getByRole('button', { name: 'Qo\'shish (0)' })).toBeDisabled();
    await fireEvent.press(screen.getByText('Sardor'));
    expect(screen.getByRole('checkbox', { name: undefined, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Qo\'shish (1)' }));
    await waitFor(() => expect(fake.api.addMembers).toHaveBeenCalledWith(CHAT_ID, [SARDOR.id]));
    expect(await screen.findByText('A\'zolar · 3')).toBeTruthy();
  });

  it('nom va tavsifni tahrirlash', async () => {
    const fake = await openInfo(group(), { updateChat: jest.fn(async () => group({ title: 'Yangi nom' })) });
    await fireEvent.press(screen.getByLabelText('Tahrirlash'));
    await fireEvent.changeText(screen.getByLabelText('Nomi'), 'Yangi nom');
    await fireEvent.press(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(fake.api.updateChat).toHaveBeenCalledWith(CHAT_ID, { title: 'Yangi nom', description: 'Hafta oxiri rejalari' }));
    expect(await screen.findByText('Yangi nom')).toBeTruthy();
  });

  it('1:1: suhbatdosh ma\'lumoti (bio)', async () => {
    const chat = directChat({ members: [member(ME), member({ ...PEER, bio: 'Toshkentdan' })] });
    await openInfo(chat);
    expect(screen.getByText('Toshkentdan')).toBeTruthy();
    expect(screen.getByText('Men haqimda')).toBeTruthy();
    expect(screen.queryByText('Guruhdan chiqish')).toBeNull();
  });
});

describe('Yangi guruh / kanal', () => {
  it('guruh: nom + a\'zo tanlash → yaratiladi va chat ochiladi', async () => {
    const created = group({ title: 'Ish' });
    const fake = createFakeServices({
      hasSession:  jest.fn(async () => true),
      searchUsers: jest.fn(async () => [PEER]),
      createGroup: jest.fn(async () => created),
    });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByLabelText('Yangi'));
    await fireEvent.press(screen.getByText('Yangi guruh'));
    expect(screen.getByRole('button', { name: 'Yaratish' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Guruh nomi'), 'Ish');
    await fireEvent.changeText(screen.getByLabelText('Foydalanuvchi qidirish'), 'Va');
    await fireEvent.press(await screen.findByText(PEER.displayName));
    await fireEvent.press(screen.getByRole('button', { name: 'Yaratish' }));
    await waitFor(() => expect(fake.api.createGroup).toHaveBeenCalledWith({ title: 'Ish', memberIds: [PEER.id] }));
    expect(await screen.findByLabelText('Xabar matni')).toBeTruthy();
  });

  it('kanal: ochiq/yopiq tanlovi', async () => {
    const created = group({ type: 'channel', title: 'Yangiliklar' });
    const fake = createFakeServices({ hasSession: jest.fn(async () => true), createChannel: jest.fn(async () => created) });
    await render(<App services={fake.services} />);
    await fireEvent.press(await screen.findByLabelText('Yangi'));
    await fireEvent.press(screen.getByText('Yangi kanal'));
    await fireEvent.changeText(screen.getByLabelText('Kanal nomi'), 'Yangiliklar');
    await fireEvent(screen.getByLabelText('Ochiq kanal'), 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Yaratish' }));
    await waitFor(() => expect(fake.api.createChannel).toHaveBeenCalledWith({ title: 'Yangiliklar', isPublic: false }));
  });
});
