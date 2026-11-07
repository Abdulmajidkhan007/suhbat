import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AdminUser } from '@suhbat/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(), block: vi.fn(), unblock: vi.fn(), revokeSessions: vi.fn(), tempPassword: vi.fn(),
  recoveryCodes: vi.fn(), deleteUser: vi.fn(), bulkDelete: vi.fn(), audit: vi.fn(),
}));
vi.mock('../../services/api', () => ({ api: { admin: mocks } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: AdminUsersPanel } = await import('./AdminUsersPanel');

vi.setConfig({ testTimeout: 20_000 });

const user = (over: Partial<AdminUser> & { id: string }): AdminUser => ({
  username: null, displayName: `Ism ${over.id}`, email: `${over.id}@test.uz`, createdAt: '2026-11-01T10:00:00.000Z', lastSeenAt: null,
  hasRecoveryCodes: false, activeSessions: 0, blocked: false, mustChangePassword: false, isAdmin: false, ...over,
});
// ME (test/render) uid = 'me'
const ROWS = [user({ id: 'me', isAdmin: true }), user({ id: 'u1', username: 'ali', activeSessions: 2, hasRecoveryCodes: true }), user({ id: 'u2', blocked: true })];
const list = (items: AdminUser[], total = items.length) => ({ items, total, page: 1, pageSize: 20 });

describe('AdminUsersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUsers.mockResolvedValue(list(ROWS));
  });

  it('jadval: foydalanuvchilar, holat belgilari; parol/hash ko\'rsatilmaydi', async () => {
    renderWithStore(<AdminUsersPanel />);
    expect(await screen.findByText('Ism u1')).toBeInTheDocument();
    expect(screen.getByText('@ali · u1@test.uz')).toBeInTheDocument();
    expect(screen.getByText('2 sessiya')).toBeInTheDocument();
    expect(screen.getByText('kodlar bor')).toBeInTheDocument();
    expect(screen.getByText('bloklangan')).toBeInTheDocument();
    expect(screen.getByText('Ism me (siz)')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/passwordHash|argon2/);
  });

  it('qidiruv: yozilgach (debounce) q bilan qayta so\'raydi', async () => {
    renderWithStore(<AdminUsersPanel />);
    await screen.findByText('Ism u1');
    fireEvent.change(screen.getByLabelText('Ism, username yoki email'), { target: { value: ' ali ' } });
    await waitFor(() => expect(mocks.listUsers).toHaveBeenLastCalledWith({ q: 'ali', page: 1, pageSize: 20 }));
  });

  it('ko\'plab o\'chirish: o\'zini tanlab bo\'lmaydi; dialog «N ta foydalanuvchi o\'chiriladi»; tasdiqlansa bulkDelete', async () => {
    mocks.bulkDelete.mockResolvedValue({ deleted: ['u1', 'u2'], notFound: [] });
    renderWithStore(<AdminUsersPanel />);
    await screen.findByText('Ism u1');
    expect(screen.getByLabelText('Tanlash: me@test.uz')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Tanlash: @ali'));
    fireEvent.click(screen.getByLabelText('Tanlash: u2@test.uz'));
    expect(screen.getByText('2 ta tanlandi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'O\'chirish' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('2 ta foydalanuvchi o\'chiriladi')).toBeInTheDocument();
    expect(mocks.bulkDelete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'O\'chirish' }));
    await waitFor(() => expect(mocks.bulkDelete).toHaveBeenCalledWith(['u1', 'u2']));
    await waitFor(() => expect(mocks.listUsers).toHaveBeenCalledTimes(2)); // ro'yxat yangilandi
  });

  it('"Hammasini tanlash" o\'zini qo\'shmaydi', async () => {
    renderWithStore(<AdminUsersPanel />);
    await screen.findByText('Ism u1');
    fireEvent.click(screen.getByLabelText('Hammasini tanlash'));
    expect(screen.getByText('2 ta tanlandi')).toBeInTheDocument();
  });

  it('vaqtinchalik parol: tasdiqlash → bir marta ko\'rsatiladi, nusxa tugmasi clipboard\'ga yozadi', async () => {
    mocks.tempPassword.mockResolvedValue('abcd-efgh-jkmn-pqrs');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithStore(<AdminUsersPanel />);
    await screen.findByText('Ism u1');
    fireEvent.click(screen.getByLabelText('Amallar: @ali'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Vaqtinchalik parol' }));
    expect(mocks.tempPassword).not.toHaveBeenCalled(); // avval tasdiq
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yaratish' }));

    expect(await screen.findByText('abcd-efgh-jkmn-pqrs')).toBeInTheDocument();
    expect(mocks.tempPassword).toHaveBeenCalledWith('u1');
    fireEvent.click(screen.getByRole('button', { name: 'Nusxa olish' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abcd-efgh-jkmn-pqrs'));
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    await waitFor(() => expect(screen.queryByText('abcd-efgh-jkmn-pqrs')).not.toBeInTheDocument());
  });

  it('qator menyusi: bloklangan uchun "Blokdan chiqarish"; o\'ziga bloklash/o\'chirish/parol o\'chiq', async () => {
    mocks.unblock.mockResolvedValue(undefined);
    renderWithStore(<AdminUsersPanel />);
    await screen.findByText('Ism u1');

    fireEvent.click(screen.getByLabelText('Amallar: me@test.uz'));
    for (const name of ['Bloklash', 'Vaqtinchalik parol', 'O\'chirish']) {
      expect(await screen.findByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Amallar: u2@test.uz'));
    expect(screen.queryByRole('menuitem', { name: 'Bloklash' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Blokdan chiqarish' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Blokdan chiqarish' }));
    await waitFor(() => expect(mocks.unblock).toHaveBeenCalledWith('u2'));
  });

  it('yuklash xatosi ko\'rsatiladi', async () => {
    mocks.listUsers.mockRejectedValue(new Error('x'));
    renderWithStore(<AdminUsersPanel />);
    expect(await screen.findByText('Ro\'yxatni yuklab bo\'lmadi.')).toBeInTheDocument();
  });
});
