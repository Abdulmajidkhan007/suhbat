import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallRegistry } from './call-registry';
import type { ActiveCall, NewCall } from './call-registry';

const caller = { id: 'u-ali', displayName: 'Ali', username: null, photoUrl: null, bio: null, createdAt: new Date(0).toISOString() };
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
  let expired: ActiveCall[];
  let reg: CallRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000;
    timedOut = [];
    expired = [];
    reg = new CallRegistry(45_000, (c) => timedOut.push(c), { graceMs: 15_000, onExpired: (c) => expired.push(c) }, () => now);
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
  describe('uzilish va tiklash (resume)', () => {
    const accepted = () => {
      reg.start(call());
      reg.accept('call-1', 's-vali');
    };

    it('detach: faqat qabul qilingan qo\'ng\'iroq; jiringlayotganga tegmaydi', () => {
      reg.start(call());
      expect(reg.detach('s-ali')).toEqual([]);
      expect(reg.get('call-1')!.callerSocket).toBe('s-ali');
      vi.advanceTimersByTime(15_000);
      expect(expired).toEqual([]);
    });

    it('muddat ichida resume — qo\'ng\'iroq davom etadi, muddat tugamaydi', () => {
      accepted();
      expect(reg.detach('s-vali').map((c) => c.id)).toEqual(['call-1']);
      expect(reg.get('call-1')!.calleeSocket).toBeNull();
      vi.advanceTimersByTime(14_000);
      const r = reg.resume('call-1', 'u-vali', 's-vali-2');
      expect(r.peerSocket).toBe('s-ali');
      expect(r.call.calleeSocket).toBe('s-vali-2');
      vi.advanceTimersByTime(60_000);
      expect(expired).toEqual([]);
      expect(reg.get('call-1')).toBeDefined();
    });

    it('muddat tugasa onExpired chaqiriladi (soxta taymer)', () => {
      accepted();
      reg.detach('s-ali');
      vi.advanceTimersByTime(14_999);
      expect(expired).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(expired.map((c) => c.id)).toEqual(['call-1']);
    });

    it('ikkala tomon uzilsa ham bitta muddat; bittasi qaytsa — hali kutiladi', () => {
      accepted();
      reg.detach('s-ali');
      vi.advanceTimersByTime(5_000);
      reg.detach('s-vali');
      const r = reg.resume('call-1', 'u-ali', 's-ali-2');
      expect(r.peerSocket).toBeNull();
      vi.advanceTimersByTime(10_000);
      expect(expired.map((c) => c.id)).toEqual(['call-1']);
    });

    it('resume: ishtirokchi bo\'lmagan yoki jiringlayotgan/yo\'q qo\'ng\'iroqda — xato', () => {
      reg.start(call());
      expect(() => reg.resume('call-1', 'u-ali', 's-x')).toThrow();
      reg.accept('call-1', 's-vali');
      expect(() => reg.resume('call-1', 'u-gani', 's-x')).toThrow();
      expect(reg.get('call-1')).toMatchObject({ callerSocket: 's-ali', calleeSocket: 's-vali' });
      expect(() => reg.resume('yo\'q', 'u-ali', 's-x')).toThrow();
    });

    it('finish muddat taymerini to\'xtatadi', () => {
      accepted();
      reg.detach('s-ali');
      reg.finish('call-1');
      vi.advanceTimersByTime(60_000);
      expect(expired).toEqual([]);
    });
  });
});
