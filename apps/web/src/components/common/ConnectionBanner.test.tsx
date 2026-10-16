import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME, renderWithStore } from '../../test/render';

const listeners = new Set<(c: boolean) => void>();
let connected = true;
vi.mock('../../services/api', () => ({
  socket: {
    isConnected: () => connected,
    onConnectionChange: (l: (c: boolean) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));

const { default: ConnectionBanner, CONNECTION_GRACE_MS } = await import('./ConnectionBanner');

const setConnected = (value: boolean) => {
  connected = value;
  listeners.forEach((l) => l(value));
};

const signedIn = { auth: { user: ME, loading: false, error: null, initialized: true } };

describe('ConnectionBanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    connected = true;
  });

  it('server bilan aloqa uzilsa — kechikish bilan "Ulanmoqda…", tiklansa yo\'qoladi', () => {
    renderWithStore(<ConnectionBanner />, signedIn);
    act(() => setConnected(false));
    expect(screen.queryByText('Ulanmoqda…')).toBeNull(); // qisqa uzilishda miltillamaydi
    act(() => vi.advanceTimersByTime(CONNECTION_GRACE_MS + 10));
    expect(screen.getByRole('status')).toHaveTextContent('Ulanmoqda…');
    act(() => setConnected(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('brauzer oflayn — "Internet yo\'q"', () => {
    renderWithStore(<ConnectionBanner />, signedIn);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('Internet yo\'q');
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tizimga kirilmagan — hech narsa ko\'rsatilmaydi', () => {
    connected = false;
    renderWithStore(<ConnectionBanner />, { auth: { user: null, loading: false, error: null, initialized: true } });
    act(() => vi.advanceTimersByTime(CONNECTION_GRACE_MS * 2));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
