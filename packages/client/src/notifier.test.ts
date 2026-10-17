import type { ServerToClientEvents } from '@suhbat/core';
import { describe, expect, it, vi } from 'vitest';
import { callNotificationTag, createMessageNotifier } from './notifier.js';
import type { ShownNotification } from './notifier.js';

const chatId = '00000000-0000-4000-8000-0000000000c1';
const me = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Ali' };
const peer = { id: '00000000-0000-4000-8000-000000000002', displayName: 'Vali', username: null, photoUrl: null, bio: null, createdAt: '2026-10-01T10:00:00.000Z' };
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const setup = (seen: (chatId: string | null) => boolean = () => false) => {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const socket = {
    on: ((event: string, l: (p: unknown) => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(l);
      listeners.set(event, set);
      return () => set.delete(l);
    }) as never,
    onConnectionChange: () => () => undefined,
  };
  const emit = <E extends keyof ServerToClientEvents>(e: E, p: Parameters<ServerToClientEvents[E]>[0]) =>
    listeners.get(e)?.forEach((l) => l(p));
  const api = {
    me:                      vi.fn(async () => me as never),
    getChat:                 vi.fn(async () => ({ id: chatId, type: 'group', title: 'Oila', members: [{ user: peer }] }) as never),
    getNotificationSettings: vi.fn(async () => ({ preview: true })),
  };
  const shown: ShownNotification[] = [];
  const cancel = vi.fn();
  const stop = createMessageNotifier({ api, socket, isSeen: seen, show: (n) => shown.push(n), cancel });
  return { emit, shown, cancel, stop, api, listeners };
};

const msg = (senderId: string, n = 1) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, chatId, senderId, type: 'text' as const,
  content: `salom ${n}`, attachment: null, createdAt: '2026-10-17T10:00:00.000Z', editedAt: null,
});

describe('createMessageNotifier', () => {
  it('guruh xabari: "Ism: matn"; o\'zimizniki va ko\'rib turilgan chat — yo\'q', async () => {
    let open: string | null = null;
    const t = setup((id) => id !== null && id === open);
    t.emit('message:new', { message: msg(me.id, 1) });
    t.emit('message:new', { message: msg(peer.id, 2) });
    await flush();
    expect(t.shown).toEqual([{ tag: chatId, kind: 'message', title: 'Oila', body: 'Vali: salom 2', chatId }]);
    open = chatId;
    t.emit('message:new', { message: msg(peer.id, 3) });
    await flush();
    expect(t.shown).toHaveLength(1);
  });

  it('qo\'ng\'iroq: ko\'rsatiladi va tugaganda bekor qilinadi; stop — tinglash to\'xtaydi', async () => {
    const t = setup();
    const callId = '00000000-0000-4000-8000-0000000000aa';
    t.emit('call:invite', { callId, chatId, media: 'audio', from: peer, createdAt: '2026-10-17T10:00:00.000Z' });
    await flush();
    expect(t.shown[0]).toMatchObject({ kind: 'call', tag: callNotificationTag(callId), title: 'Vali' });
    t.emit('call:end', { callId, reason: 'cancelled', durationMs: null } as never);
    expect(t.cancel).toHaveBeenCalledWith(callNotificationTag(callId));
    t.stop();
    expect([...t.listeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});
