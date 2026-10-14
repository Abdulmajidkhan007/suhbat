import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary, PublicChannel, PublicUser } from '@suhbat/core';
import { makeChat, renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({
  searchUsers:          vi.fn(),
  searchPublicChannels: vi.fn(),
  createDirectChat:     vi.fn(),
  joinChannel:          vi.fn(),
}));
vi.mock('../../services/api', () => ({ api: mocks }));

const { default: ChatList } = await import('./ChatList');

const USER_ID = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e51';
const CH_ID   = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e52';
const testUser: PublicUser = { id: USER_ID, displayName: 'Test Foydalanuvchi', photoUrl: null, bio: 'Salom', createdAt: '2026-10-01T10:00:00.000Z' };
const testChannel: PublicChannel = { id: CH_ID, title: 'Test kanal', description: 'Sinov', memberCount: 12, isMember: false };

const directSummary = (): ChatSummary => ({
  id: 'dddddddd-1d2a-4c3b-9e8f-0a1b2c3d4e53', type: 'direct', title: null, description: null, isPublic: false,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  members: [
    { user: { ...testUser, id: 'me-id' }, role: 'member', lastReadAt: null, lastSeenAt: null },
    { user: testUser, role: 'member', lastReadAt: null, lastSeenAt: null },
  ],
  memberCount: 2, lastMessage: null, unreadCount: 0,
});

const setup = () => {
  const onSelectChat = vi.fn();
  const utils = renderWithStore(
    <ChatList
      chats={[makeChat()]}
      activeChatId={null}
      currentUid="me"
      loading={false}
      error={null}
      onlineUsers={{}}
      onSelectChat={onSelectChat}
    />,
  );
  return { onSelectChat, ...utils };
};

const type = (value: string) => fireEvent.change(screen.getByLabelText('Qidirish'), { target: { value } });

describe('ChatList — global qidiruv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchUsers.mockResolvedValue([]);
    mocks.searchPublicChannels.mockResolvedValue([]);
  });

  it('placeholder "Qidirish"; so\'rov yo\'q — API chaqirilmaydi', () => {
    setup();
    expect(screen.getByPlaceholderText('Qidirish')).toBeInTheDocument();
    expect(mocks.searchUsers).not.toHaveBeenCalled();
  });

  it('"Test" yozilsa foydalanuvchilar va ochiq kanallar bo\'limlari chiqadi (mavjud suhbat bo\'lmasa ham)', async () => {
    mocks.searchUsers.mockResolvedValue([testUser]);
    mocks.searchPublicChannels.mockResolvedValue([testChannel]);
    setup();
    type('Test');

    expect(await screen.findByText('Test Foydalanuvchi')).toBeInTheDocument();
    expect(screen.getByText('Test kanal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Foydalanuvchilar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ochiq kanallar' })).toBeInTheDocument();
    expect(screen.queryByText('Topilmadi')).toBeNull();
    expect(mocks.searchUsers).toHaveBeenCalledWith('Test');
    expect(mocks.searchPublicChannels).toHaveBeenCalledWith('Test');
  });

  it('debounce: tez yozilgan harflar bitta so\'rov beradi, kutish paytida yuklanish ko\'rinadi', async () => {
    setup();
    type('T'); type('Te'); type('Tes');
    expect(screen.getByRole('status', { name: 'Qidirilmoqda' })).toBeInTheDocument();
    expect(mocks.searchUsers).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.searchUsers).toHaveBeenCalledTimes(1));
    expect(mocks.searchUsers).toHaveBeenCalledWith('Tes');
  });

  it('hech narsa topilmasa — "Topilmadi"', async () => {
    setup();
    type('zzz');
    expect(await screen.findByText('Topilmadi')).toBeInTheDocument();
  });

  it('mavjud suhbat ham "Suhbatlar" bo\'limida (nom bo\'yicha filtr)', async () => {
    setup();
    type('Vali');
    expect(await screen.findByRole('heading', { name: 'Suhbatlar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Suhbatlar' })).toHaveTextContent('Vali');
  });

  it('xatolik: bo\'lim xabari va "Qayta urinish" — qayta so\'raydi; ikkinchi bo\'lim ishlayveradi', async () => {
    mocks.searchUsers.mockRejectedValueOnce(new Error('tarmoq'));
    mocks.searchPublicChannels.mockResolvedValue([testChannel]);
    setup();
    type('Test');

    expect(await screen.findByRole('alert')).toHaveTextContent('Foydalanuvchilarni qidirib bo\'lmadi.');
    expect(screen.getByText('Test kanal')).toBeInTheDocument();

    mocks.searchUsers.mockResolvedValue([testUser]);
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(await screen.findByText('Test Foydalanuvchi')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('foydalanuvchini bosish — 1:1 chat yaratiladi va ochiladi', async () => {
    mocks.searchUsers.mockResolvedValue([testUser]);
    mocks.createDirectChat.mockResolvedValue(directSummary());
    const { onSelectChat } = setup();
    type('Test');

    fireEvent.click(await screen.findByText('Test Foydalanuvchi'));
    await waitFor(() => expect(onSelectChat).toHaveBeenCalledWith(directSummary().id));
    expect(mocks.createDirectChat).toHaveBeenCalledWith(USER_ID);
  });

  it('kanalni bosish — ko\'rinish oynasi, "Obuna bo\'lish" bosilsa obuna bo\'lib kanal ochiladi', async () => {
    mocks.searchPublicChannels.mockResolvedValue([testChannel]);
    const joined: ChatSummary = { ...directSummary(), id: CH_ID, type: 'channel', title: 'Test kanal' };
    mocks.joinChannel.mockResolvedValue(joined);
    const { onSelectChat } = setup();
    type('Test');

    fireEvent.click(await screen.findByText('Test kanal'));
    expect(await screen.findByText('12 obunachi · ochiq kanal')).toBeInTheDocument();
    expect(screen.getByText('Sinov')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Obuna bo\'lish' }));
    await waitFor(() => expect(onSelectChat).toHaveBeenCalledWith(CH_ID));
    expect(mocks.joinChannel).toHaveBeenCalledWith(CH_ID);
  });
});
