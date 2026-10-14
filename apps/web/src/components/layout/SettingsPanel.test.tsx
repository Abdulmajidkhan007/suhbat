import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn() }));
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
});
