import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallState } from '@suhbat/client';

type Listener = (s: CallState<MediaStream> | null) => void;
const store = vi.hoisted(() => ({ state: null as CallState<MediaStream> | null, listeners: new Set<Listener>() }));

vi.mock('../../services/calls', () => ({
  callManager: {
    subscribe:       (l: Listener) => { store.listeners.add(l); return () => store.listeners.delete(l); },
    getState:        () => store.state,
    accept:          vi.fn(async () => undefined),
    reject:          vi.fn(),
    hangup:          vi.fn(),
    setMuted:        vi.fn(),
    setCameraOff:    vi.fn(),
    switchCamera:    vi.fn(async () => undefined),
    dismiss:         vi.fn(),
    canSwitchCamera: false,
  },
}));

const { callManager } = await import('../../services/calls');
const { default: CallOverlay } = await import('./CallOverlay');

const set = (patch: Partial<CallState<MediaStream>> | null) => {
  store.state = patch && {
    phase: 'ringing', callId: 'c1', chatId: 'chat-1', media: 'audio', direction: 'incoming',
    peer: { id: 'u-ali', displayName: 'Ali', photoUrl: null }, remoteRinging: false, reconnecting: false,
    connectedAt: null, muted: false, cameraOff: false, localStream: null, remoteStream: null, endReason: null, error: null,
    ...patch,
  };
  act(() => store.listeners.forEach((l) => l(store.state)));
};

describe('CallOverlay', () => {
  beforeEach(() => {
    store.state = null;
    vi.clearAllMocks();
  });

  it('qo\'ng\'iroq yo\'q — hech narsa; kiruvchi — qabul oynasi; qabul — ekran', () => {
    render(<CallOverlay />);
    expect(screen.queryByRole('dialog')).toBeNull();

    set({});
    fireEvent.click(screen.getByRole('button', { name: 'Qabul qilish' }));
    expect(callManager.accept).toHaveBeenCalledOnce();

    set({ phase: 'connecting' });
    expect(screen.getByRole('status')).toHaveTextContent('Ulanmoqda…');
    fireEvent.click(screen.getByRole('button', { name: 'Mikrofonni o\'chirish' }));
    expect(callManager.setMuted).toHaveBeenCalledWith(true);
  });

  it('javob berilmagan kiruvchi tugasa (bekor qilindi) — ekran chiqmaydi; chiquvchi tugasa — sabab', () => {
    render(<CallOverlay />);
    set({ phase: 'ended', endReason: 'cancelled' });
    expect(screen.queryByRole('dialog')).toBeNull();

    set({ phase: 'ended', direction: 'outgoing', endReason: 'busy' });
    expect(screen.getByRole('status')).toHaveTextContent('Band');
  });
});
