import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../../test/render';
import AppShell from './AppShell';

const setViewport = (mobile: boolean) => {
  window.matchMedia = ((query: string) => ({
    // MUI `down('md')` → "(max-width:899.95px)"
    matches: mobile && query.includes('max-width'),
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const shell = (mobileView: 'list' | 'chat') => (
  <AppShell mobileView={mobileView} sidebar={<div>RO'YXAT</div>} main={<div>CHAT</div>} />
);

describe('AppShell', () => {
  afterEach(() => { Reflect.deleteProperty(window, 'matchMedia'); });

  it('telefon: ro\'yxat ochiq — faqat ro\'yxat (to\'liq kenglik, chat yo\'q, drawer/backdrop yo\'q)', () => {
    setViewport(true);
    renderWithStore(shell('list'));
    expect(screen.getByText('RO\'YXAT')).toBeInTheDocument();
    expect(screen.queryByText('CHAT')).toBeNull();
    expect(document.querySelector('.MuiBackdrop-root')).toBeNull();
    expect(screen.getByRole('button', { name: /Sozlamalar/ })).toBeInTheDocument();
  });

  it('telefon: chat ochilganda ro\'yxat yashirinadi', () => {
    setViewport(true);
    renderWithStore(shell('chat'));
    expect(screen.getByText('CHAT')).toBeInTheDocument();
    expect(screen.queryByText('RO\'YXAT')).toBeNull();
  });

  it('keng ekran: ikkalasi yonma-yon', () => {
    setViewport(false);
    renderWithStore(shell('chat'));
    expect(screen.getByText('RO\'YXAT')).toBeInTheDocument();
    expect(screen.getByText('CHAT')).toBeInTheDocument();
  });
});
