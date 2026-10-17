import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chatId = '00000000-0000-4000-8000-0000000000c1';
const me = '00000000-0000-4000-8000-000000000001';
const peer = { id: '00000000-0000-4000-8000-000000000002', displayName: 'Vali', username: null, photoUrl: null, bio: null, createdAt: '2026-10-01T10:00:00.000Z' };

const h = vi.hoisted(() => {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  return {
    listeners,
    socket: {
      on: (event: string, l: (p: unknown) => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(l);
        listeners.set(event, set);
        return () => set.delete(l);
      },
      onConnectionChange: () => () => undefined,
    },
    api: {
      me:                      vi.fn(),
      getChat:                 vi.fn(),
      getNotificationSettings: vi.fn(),
    },
  };
});
vi.mock('../services/api', () => ({ api: h.api, socket: h.socket }));

import { useSystemNotifications } from './useSystemNotifications';

const emit = (event: string, payload: unknown) => h.listeners.get(event)?.forEach((l) => l(payload));
const flush = () => new Promise((r) => setTimeout(r, 0));

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
  static created: FakeNotification[] = [];
  onclick: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  constructor(readonly title: string, readonly options: NotificationOptions) {
    FakeNotification.created.push(this);
  }
}

const message = (senderId: string) => ({
  id: '00000000-0000-4000-8000-000000000101', chatId, senderId, type: 'text', content: 'salom',
  attachment: null, createdAt: '2026-10-17T10:00:00.000Z', editedAt: null,
});

describe('useSystemNotifications', () => {
  let focused = false;

  beforeEach(() => {
    FakeNotification.created = [];
    vi.stubGlobal('Notification', FakeNotification);
    vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
    vi.spyOn(window, 'focus').mockImplementation(() => undefined);
    h.api.me.mockResolvedValue({ id: me });
    h.api.getChat.mockResolvedValue({
      id: chatId, type: 'direct', title: null,
      members: [{ user: peer }, { user: { ...peer, id: me, displayName: 'Ali' } }],
    });
    h.api.getNotificationSettings.mockResolvedValue({ preview: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    h.listeners.clear();
  });

  it('fokus yo\'q: begona xabar — bildirishnoma; bosilsa chat ochiladi', async () => {
    focused = false;
    const open = vi.fn();
    renderHook(() => useSystemNotifications(open));
    emit('message:new', { message: message(me) });
    emit('message:new', { message: message(peer.id) });
    await flush();
    expect(FakeNotification.created).toHaveLength(1);
    const [n] = FakeNotification.created;
    expect(n?.title).toBe('Vali');
    expect(n?.options).toMatchObject({ body: 'salom', tag: chatId });
    n?.onclick?.();
    expect(open).toHaveBeenCalledWith(chatId);
  });

  it('sahifa fokusda — bildirishnoma yo\'q; ruxsat birinchi bosishda so\'raladi', async () => {
    focused = true;
    FakeNotification.permission = 'default';
    renderHook(() => useSystemNotifications(vi.fn()));
    emit('message:new', { message: message(peer.id) });
    await flush();
    expect(FakeNotification.created).toHaveLength(0);
    window.dispatchEvent(new Event('pointerdown'));
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    FakeNotification.permission = 'granted';
  });
});
