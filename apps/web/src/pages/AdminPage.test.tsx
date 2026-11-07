import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ME, renderWithStore } from '../test/render';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  audit: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
}));
vi.mock('../services/api', () => ({ api: { admin: mocks } }));

const { default: AdminPage } = await import('./AdminPage');
const { default: AdminLink } = await import('../components/layout/AdminLink');

vi.setConfig({ testTimeout: 20_000 });

const auth = (isAdmin: boolean) => ({ auth: { user: { ...ME, isAdmin }, loading: false, error: null, initialized: true } });

describe('AdminPage', () => {
  it('admin bo\'lmasa "Sahifa topilmadi" va hech narsa so\'ralmaydi', () => {
    renderWithStore(<MemoryRouter><AdminPage /></MemoryRouter>, auth(false));
    expect(screen.getByText('Sahifa topilmadi')).toBeInTheDocument();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it('admin uchun panel ochiladi', async () => {
    renderWithStore(<MemoryRouter><AdminPage /></MemoryRouter>, auth(true));
    expect(screen.getByText('Admin panel')).toBeInTheDocument();
    expect(await screen.findByText('Foydalanuvchilar yo\'q')).toBeInTheDocument();
  });
});

describe('AdminLink (Sozlamalar)', () => {
  it('faqat isAdmin bo\'lsa ko\'rinadi', () => {
    const { unmount } = renderWithStore(<MemoryRouter><AdminLink /></MemoryRouter>, auth(false));
    expect(screen.queryByText('Admin panel')).not.toBeInTheDocument();
    unmount();
    renderWithStore(<MemoryRouter><AdminLink /></MemoryRouter>, auth(true));
    expect(screen.getByText('Admin panel')).toBeInTheDocument();
  });
});
