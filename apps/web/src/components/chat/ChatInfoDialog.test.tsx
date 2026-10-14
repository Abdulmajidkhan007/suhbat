import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary, PublicUser } from '@suhbat/core';
import { makeChat, renderWithStore } from '../../test/render';
import type { Chat } from '../../types';

const mocks = vi.hoisted(() => ({
  searchUsers: vi.fn(),
  addMembers:  vi.fn(),
}));
vi.mock('../../services/api', () => ({ api: mocks }));

const { default: ChatInfoDialog } = await import('./ChatInfoDialog');

const NEW_ID = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e61';
const newUser: PublicUser = { id: NEW_ID, displayName: 'Yangi Odam', photoUrl: null, bio: null, createdAt: '2026-10-01T10:00:00.000Z' };

const part = (uid: string, displayName: string, role: 'owner' | 'admin' | 'member') =>
  ({ uid, displayName, photoURL: null, isOnline: false, lastSeen: 0, lastReadAt: null, role });

/** Kanal: ega + admin + o'zim (oddiy obunachi, ismi "Owner") — API aynan shu to'plamni qaytaradi. */
const channelAsSubscriber = (): Chat => makeChat({
  id: 'ch1', name: 'Yangiliklar', type: 'channel', myRole: 'member', memberCount: 25, isPublic: true,
  participants: ['boss', 'adm', 'me'],
  participantDetails: {
    boss: part('boss', 'Bosh Ega', 'owner'),
    adm:  part('adm', 'Adminjon', 'admin'),
    me:   part('me', 'Owner', 'member'),
  },
});

const channelAsOwner = (): Chat => makeChat({
  ...channelAsSubscriber(), myRole: 'owner',
  participantDetails: {
    me:  part('me', 'Ali Valiyev', 'owner'),
    adm: part('adm', 'Adminjon', 'admin'),
  },
  participants: ['me', 'adm'],
});

const renderDialog = (chat: Chat) =>
  renderWithStore(<ChatInfoDialog chat={chat} open onClose={vi.fn()} onLeft={vi.fn()} />);

describe('ChatInfoDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kanal: "Ega va adminlar"da faqat ega/adminlar; oddiy obunachi ("Owner") ko\'rinmaydi; obunachilar soni alohida', () => {
    renderDialog(channelAsSubscriber());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Bosh Ega')).toBeInTheDocument();
    expect(within(dialog).getByText('Adminjon')).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Owner/)).toBeNull();
    // 25 a'zo − 1 ega − 1 admin = 23 obunachi
    expect(within(dialog).getByText('23 obunachi · ochiq kanal')).toBeInTheDocument();
  });

  it('guruhda hamma a\'zo ko\'rinadi', () => {
    renderDialog(makeChat({
      id: 'g1', name: 'Guruh', type: 'group', myRole: 'member', memberCount: 2,
      participantDetails: { me: part('me', 'Ali Valiyev', 'member'), v: part('v', 'Vali', 'member') },
    }));
    expect(screen.getByText('Vali')).toBeInTheDocument();
    expect(screen.getByText('2 a\'zo')).toBeInTheDocument();
  });

  it('obunachi qo\'shish: tanlangan qator belgilanadi va "Qo\'shish" tugmasi faollashadi', async () => {
    mocks.searchUsers.mockResolvedValue([newUser]);
    const updated: ChatSummary = {
      id: 'ch1', type: 'channel', title: 'Yangiliklar', description: null, isPublic: true,
      createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
      members: [], memberCount: 26, lastMessage: null, unreadCount: 0,
    };
    mocks.addMembers.mockResolvedValue(updated);
    renderDialog(channelAsOwner());

    const add = screen.getByRole('button', { name: /^Qo'shish/ });
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Ism yoki to\'liq email…'), { target: { value: 'Yangi' } });
    const row = await screen.findByRole('checkbox', { name: /Yangi Odam/ });
    expect(row).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(row);
    expect(screen.getByRole('checkbox', { name: /Yangi Odam/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Qo\'shish (1)' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Qo\'shish (1)' }));
    await waitFor(() => expect(mocks.addMembers).toHaveBeenCalledWith('ch1', [NEW_ID]));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Qo'shish/ })).toBeDisabled());
  });

  it('tanlovni qayta bosish — belgi olinadi, tugma yana o\'chadi', async () => {
    mocks.searchUsers.mockResolvedValue([newUser]);
    renderDialog(channelAsOwner());
    fireEvent.change(screen.getByLabelText('Ism yoki to\'liq email…'), { target: { value: 'Yangi' } });
    const row = await screen.findByRole('checkbox', { name: /Yangi Odam/ });
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('checkbox', { name: /Yangi Odam/ }));
    expect(screen.getByRole('button', { name: /^Qo'shish/ })).toBeDisabled();
  });
});
