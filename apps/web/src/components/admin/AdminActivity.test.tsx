import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AdminActivityEntry } from '@suhbat/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../../test/render';

const mocks = vi.hoisted(() => ({
  activity: vi.fn(), media: vi.fn(), mediaPreview: vi.fn(), reports: vi.fn(), listUsers: vi.fn(),
}));
vi.mock('../../services/api', () => ({ api: { admin: mocks } }));

const { default: AdminActivityPanel } = await import('./AdminActivityPanel');
const { default: AdminMediaPanel } = await import('./AdminMediaPanel');
const { default: AdminReportsPanel } = await import('./AdminReportsPanel');

vi.setConfig({ testTimeout: 20_000 });

const U = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
const entry = (over: Partial<AdminActivityEntry>): AdminActivityEntry => ({
  id: crypto.randomUUID(), type: 'login', userId: U, userLabel: 'Ali (@ali)', chatId: null, chatKind: null, chatPublic: null,
  ip: '10.0.0.1', device: 'Firefox/130', meta: null, media: null, createdAt: '2026-11-07T10:00:00.000Z', ...over,
});
const page = (items: AdminActivityEntry[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
const media = (name: string, previewable: boolean, chatKind: 'private' | 'channel') => entry({
  type: 'media_upload', chatKind, chatPublic: chatKind === 'channel' ? true : null,
  media: { kind: 'image', mime: 'image/png', size: 2048, name, attachmentId: crypto.randomUUID(), previewable },
});

describe('AdminActivityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
  });

  it('metadata ko\'rsatiladi (uzunlik, chat turi, IP, qurilma), maxfiylik izohi bor; matn ustuni yo\'q', async () => {
    mocks.activity.mockResolvedValue(page([
      entry({ type: 'message_send', chatKind: 'private', meta: { length: 42, hasAttachment: false } }),
      entry({ type: 'login_failed', userId: null, userLabel: null, meta: { reason: 'bad_credentials' } }),
    ]));
    renderWithStore(<AdminActivityPanel />);
    expect(await screen.findByText('Xabar yubordi')).toBeInTheDocument();
    expect(screen.getByText('42 belgi')).toBeInTheDocument();
    expect(screen.getByText('Shaxsiy (1:1)')).toBeInTheDocument();
    expect(screen.getByText('Kirish muvaffaqiyatsiz')).toBeInTheDocument();
    expect(screen.getAllByText('10.0.0.1').length).toBe(2);
    expect(screen.getByText(/matni/)).toBeInTheDocument(); // PrivacyNote
  });

  it('filtrlar so\'rovga uzatiladi (tur, chat turi, sana)', async () => {
    mocks.activity.mockResolvedValue(page([]));
    renderWithStore(<AdminActivityPanel />);
    await waitFor(() => expect(mocks.activity).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByLabelText('Turi'));
    fireEvent.click(await screen.findByRole('option', { name: 'Xabar yubordi' }));
    await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'message_send', page: 1 })));
    fireEvent.change(screen.getByLabelText('Dan'), { target: { value: '2026-11-01' } });
    await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'message_send', from: expect.any(String) })));
  });

  it('fixedUserId — shu foydalanuvchi tarixi, foydalanuvchi filtri yo\'q', async () => {
    mocks.activity.mockResolvedValue(page([entry({})]));
    renderWithStore(<AdminActivityPanel fixedUserId={U} showNote={false} />);
    await waitFor(() => expect(mocks.activity).toHaveBeenCalledWith(expect.objectContaining({ userId: U })));
    expect(screen.queryByLabelText('Foydalanuvchi')).toBeNull();
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });
});

describe('AdminMediaPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('jami hajm; 1:1 media "maxfiy" (ko\'rish tugmasi yo\'q), ochiq kanal — "Ko\'rish" prevyu', async () => {
    mocks.media.mockResolvedValue({
      ...page([media('shaxsiy.png', false, 'private'), media('ochiq.png', true, 'channel')]),
      stats: { totalCount: 2, totalBytes: 4096, byKind: [{ kind: 'image', count: 2, bytes: 4096 }] },
    });
    mocks.mediaPreview.mockResolvedValue({ url: 'https://files/ochiq.png', name: 'ochiq.png', mime: 'image/png', kind: 'image' });
    renderWithStore(<AdminMediaPanel />);

    expect(await screen.findByText('shaxsiy.png')).toBeInTheDocument();
    expect(screen.getByTestId('media-stats')).toHaveTextContent('2 ta fayl · 4.0 KB');
    expect(screen.getAllByText('maxfiy')).toHaveLength(1);
    const buttons = screen.getAllByRole('button', { name: 'Ko\'rish' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://files/ochiq.png');
    expect(mocks.mediaPreview).toHaveBeenCalledTimes(1);
  });
});

describe('AdminReportsPanel', () => {
  it('shikoyat qilingan xabar mazmuni ko\'rinadi', async () => {
    mocks.reports.mockResolvedValue({
      items: [{
        id: crypto.randomUUID(), createdAt: '2026-11-07T10:00:00.000Z', reason: 'haqorat', reporterLabel: 'Vali (@vali)', chatKind: 'private',
        message: { id: U, chatId: U, senderId: U, senderLabel: 'Ali (@ali)', type: 'text', content: 'shikoyat qilingan matn', createdAt: '2026-11-07T09:59:00.000Z', deleted: false, attachmentId: null },
      }],
      total: 1, page: 1, pageSize: 20,
    });
    renderWithStore(<AdminReportsPanel />);
    expect(await screen.findByText('shikoyat qilingan matn')).toBeInTheDocument();
    expect(screen.getByText('Izoh: haqorat')).toBeInTheDocument();
    expect(screen.getByText(/Faqat foydalanuvchi shikoyat qilgan/)).toBeInTheDocument();
  });
});
