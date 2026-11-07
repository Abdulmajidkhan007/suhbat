import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME, renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({ changePassword: vi.fn(), logout: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mocks }));

const { default: ProtectedRoute } = await import('./ProtectedRoute');

vi.setConfig({ testTimeout: 20_000 });

const state = (mustChangePassword: boolean) => ({
  auth: { user: { ...ME, mustChangePassword }, loading: false, error: null, initialized: true },
});
const ui = <MemoryRouter><ProtectedRoute><div>CHATLAR</div></ProtectedRoute></MemoryRouter>;

describe('majburiy parol almashtirish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('oddiy foydalanuvchi ilovani ko\'radi', () => {
    renderWithStore(ui, state(false));
    expect(screen.getByText('CHATLAR')).toBeInTheDocument();
  });

  it('vaqtinchalik paroldagi foydalanuvchi yangi parol o\'rnatmaguncha ilovani ko\'rmaydi', async () => {
    mocks.changePassword.mockResolvedValue({
      id: 'me', email: 'me@test.uz', displayName: 'Ali Valiyev', username: null, photoUrl: null, bio: null,
      createdAt: '2026-10-01T10:00:00.000Z', mustChangePassword: false,
    });
    const { store } = renderWithStore(ui, state(true));
    expect(screen.queryByText('CHATLAR')).not.toBeInTheDocument();
    expect(screen.getByText('Yangi parol o\'rnating')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Vaqtinchalik parol'), { target: { value: 'abcd-efgh-jkmn-pqrs' } });
    fireEvent.change(screen.getByLabelText('Yangi parol'), { target: { value: 'yangi-parol-1' } });
    fireEvent.change(screen.getByLabelText('Parolni tasdiqlang'), { target: { value: 'boshqa-parol-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    expect(await screen.findByText('Parollar mos emas.')).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Parolni tasdiqlang'), { target: { value: 'yangi-parol-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parolni saqlash' }));
    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledWith('abcd-efgh-jkmn-pqrs', 'yangi-parol-1'));
    expect(await screen.findByText('CHATLAR')).toBeInTheDocument();
    expect(store.getState().auth.user?.mustChangePassword).toBe(false);
  });
});
