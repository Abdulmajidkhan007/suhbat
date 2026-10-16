import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), checkUsername: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mocks }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: SettingsPanel } = await import('./SettingsPanel');

describe('SettingsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('o\'zbekcha matnlar; texnologiya yozuvi yo\'q, faqat "Suhbat v{versiya}"', () => {
    renderWithStore(<SettingsPanel />);
    expect(screen.getByText('Sozlamalar')).toBeInTheDocument();
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Ko\'rinish')).toBeInTheDocument();
    expect(screen.getByText('Yorug\'')).toBeInTheDocument();
    expect(screen.getByText('Qorong\'i')).toBeInTheDocument();
    expect(screen.getByText(/^Suhbat v\d+\.\d+\.\d+/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NestJS|Socket\.IO|React ·/);
    expect(document.body.textContent).not.toMatch(/Settings|Appearance|Profile\b|Light|Dark/);
  });

  it('o\'zgarish yo\'q yoki ism bo\'sh — "Saqlash" o\'chiq', () => {
    renderWithStore(<SettingsPanel />);
    const save = screen.getByRole('button', { name: 'Saqlash' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ism'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    expect(screen.getByText('Ism bo\'sh bo\'lmasin')).toBeInTheDocument();
  });

  it('ism va bio saqlanadi, javob store\'ga yoziladi', async () => {
    mocks.updateProfile.mockResolvedValue({
      id: 'me', email: 'me@test.uz', displayName: 'Ali Yangi', photoUrl: null, bio: 'Dasturchi', createdAt: '2026-10-01T10:00:00.000Z',
    });
    const { store } = renderWithStore(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText('Ism'), { target: { value: ' Ali Yangi ' } });
    fireEvent.change(screen.getByLabelText('Men haqimda'), { target: { value: 'Dasturchi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Ali Yangi', bio: 'Dasturchi' }));
    await waitFor(() => expect(store.getState().auth.user?.displayName).toBe('Ali Yangi'));
    expect(store.getState().auth.user?.bio).toBe('Dasturchi');
    expect(store.getState().auth.user?.email).toBe('me@test.uz');
  });

  it('username: jonli tekshiruv, band bo\'lsa saqlab bo\'lmaydi, bo\'sh bo\'lsa saqlanadi', async () => {
    mocks.checkUsername.mockImplementation(async (u: string) =>
      ({ username: u, available: u !== 'band_user', reason: u === 'band_user' ? 'Bu username band' : null }));
    mocks.updateProfile.mockResolvedValue({
      id: 'me', email: 'me@test.uz', displayName: 'Ali Valiyev', username: 'ali_yangi', photoUrl: null, bio: null, createdAt: '2026-10-01T10:00:00.000Z',
    });
    const { store } = renderWithStore(<SettingsPanel />);
    const save = screen.getByRole('button', { name: 'Saqlash' });
    const field = screen.getByLabelText('Username');

    fireEvent.change(field, { target: { value: 'band_user' } });
    expect(await screen.findByText('Bu username band')).toBeInTheDocument();
    expect(save).toBeDisabled();

    fireEvent.change(field, { target: { value: '@Ali_Yangi' } });
    expect(await screen.findByText('Bo\'sh — olish mumkin')).toBeInTheDocument();
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Ali Valiyev', bio: '', username: 'ali_yangi' }));
    await waitFor(() => expect(store.getState().auth.user?.username).toBe('ali_yangi'));
    expect(screen.getByText('Joriy username')).toBeInTheDocument();
  });
});
