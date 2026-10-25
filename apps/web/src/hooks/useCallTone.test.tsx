import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallState } from '@suhbat/client';

const store = vi.hoisted(() => ({ state: null as Partial<CallState<MediaStream>> | null }));
const player = vi.hoisted(() => ({
  set: vi.fn(),
  isBlocked: vi.fn(() => false),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock('./useCall', () => ({ useCall: () => store.state }));
vi.mock('../services/callTones', () => ({ callTonePlayer: player }));

const { useCallTone } = await import('./useCallTone');

describe('useCallTone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.state = null;
  });

  it('kiruvchi jiringlash — ring, chiquvchi kutish — ringback, ulangach/yo\'q — o\'chadi; unmount to\'xtatadi', () => {
    store.state = { phase: 'ringing', direction: 'incoming' };
    const { rerender, unmount } = renderHook(() => useCallTone());
    expect(player.set).toHaveBeenLastCalledWith('ring');

    store.state = { phase: 'connecting', direction: 'incoming' };
    rerender();
    expect(player.set).toHaveBeenLastCalledWith(null);

    store.state = { phase: 'calling', direction: 'outgoing' };
    rerender();
    expect(player.set).toHaveBeenLastCalledWith('ringback');

    unmount();
    expect(player.set).toHaveBeenLastCalledWith(null);
  });

  it('o\'ynatgich bloklangan bo\'lsa true qaytaradi', () => {
    player.isBlocked.mockReturnValue(true);
    const { result } = renderHook(() => useCallTone());
    expect(result.current).toBe(true);
  });
});
