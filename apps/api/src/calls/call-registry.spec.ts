import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallRegistry } from './call-registry';
import type { ActiveCall, NewCall } from './call-registry';

const caller = { id: 'u-ali', displayName: 'Ali', photoUrl: null, createdAt: new Date(0).toISOString() };
const call = (over: Partial<NewCall> = {}): NewCall => ({
  id:           'call-1',
  chatId:       'chat-1',
  media:        'audio',
  callerId:     'u-ali',
  calleeId:     'u-vali',
  callerSocket: 's-ali',
  caller,
  ...over,
});

describe('CallRegistry', () => {
  let now = 1_000;
  let timedOut: ActiveCall[];
  let reg: CallRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000;
    timedOut = [];
    reg = new CallRegistry(45_000, (c) => timedOut.push(c), () => now);
  });
  afterEach(() => {
    reg.clear();
    vi.useRealTimers();
  });

  it('start: ikkala foydalanuvchi band, takror callId/band foydalanuvchi — xato', () => {
    reg.start(call());
    expect(reg.isBusy('u-ali')).toBe(true);
    expect(reg.ofUser('u-vali')?.id).toBe('call-1');
    expect(() => reg.start(call())).toThrow();
    expect(() => reg.start(call({ id: 'call-2', callerId: 'u-gani', calleeId: 'u-vali' }))).toThrow();
  });

  it('javob bo\'lmasa timeout chaqiriladi; qabul qilingan qo\'ng\'iroqda — yo\'q', () => {
    reg.start(call());
    reg.start(call({ id: 'call-2', callerId: 'u-a', calleeId: 'u-b' }));
    reg.accept('call-2', 's-b');
    vi.advanceTimersByTime(45_000);
    expect(timedOut.map((c) => c.id)).toEqual(['call-1']);
  });

  it('accept: socket bog\'lanadi, davomiylik qabul qilingandan hisoblanadi', () => {
    reg.start(call());
    expect(reg.durationMs(reg.get('call-1')!)).toBeNull();
    now = 5_000;
    const c = reg.accept('call-1', 's-vali');
    expect(c).toMatchObject({ status: 'accepted', calleeSocket: 's-vali', acceptedAt: 5_000 });
    expect(() => reg.accept('call-1', 's-vali')).toThrow();
    now = 197_000;
    expect(reg.durationMs(c)).toBe(192_000);
    expect(reg.socketOf(c, 'u-ali')).toBe('s-ali');
    expect(reg.socketOf(c, 'u-vali')).toBe('s-vali');
    expect(reg.socketOf(c, 'u-gani')).toBeNull();
  });

  it('bySocket va finish: tozalanadi, ikkinchi finish — undefined', () => {
    reg.start(call());
    reg.accept('call-1', 's-vali');
    expect(reg.bySocket('s-vali').map((c) => c.id)).toEqual(['call-1']);
    expect(reg.bySocket('s-boshqa')).toEqual([]);
    expect(reg.finish('call-1')?.id).toBe('call-1');
    expect(reg.finish('call-1')).toBeUndefined();
    expect(reg.isBusy('u-ali')).toBe(false);
    expect(reg.isBusy('u-vali')).toBe(false);
    expect(reg.size).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(timedOut).toEqual([]);
  });
});
