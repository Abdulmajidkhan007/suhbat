import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPrivacyInfo: vi.fn() }));
vi.mock('../services/api', () => ({ api: mocks }));
const { default: PrivacyPage } = await import('./PrivacyPage');

vi.setConfig({ testTimeout: 20_000 });

describe('PrivacyPage', () => {
  it('serverdagi saqlash muddati ko\'rsatiladi; xabar matni o\'qilmasligi aytiladi', async () => {
    mocks.getPrivacyInfo.mockResolvedValue({ retentionDays: 30 });
    render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
    expect(await screen.findByText(/30 kun saqlanadi/)).toBeInTheDocument();
    expect(screen.getByText('Nima yoziladi')).toBeInTheDocument();
    expect(screen.getByText(/xabarlarining MATNI administratorga ko'rinmaydi/)).toBeInTheDocument();
    expect(screen.getByText(/shikoyat \(report\) qilsa/)).toBeInTheDocument();
  });

  it('server javob bermasa standart muddat va ogohlantirish', async () => {
    mocks.getPrivacyInfo.mockRejectedValue(new Error('x'));
    render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
    expect(await screen.findByText(/serverdan olib bo'lmadi/)).toBeInTheDocument();
    expect(screen.getByText(/90 kun saqlanadi/)).toBeInTheDocument();
  });
});
