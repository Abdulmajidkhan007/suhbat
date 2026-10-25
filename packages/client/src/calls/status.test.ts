import { describe, expect, it } from 'vitest';
import { callStatusText, callToneFor, isSilentEnd } from './status.js';
import type { CallState } from './types.js';

const base: Parameters<typeof callStatusText>[0] = {
  phase: 'calling', direction: 'outgoing', media: 'audio', remoteRinging: false, reconnecting: false,
  connectedAt: null, endReason: null, error: null,
} satisfies Partial<CallState<unknown>>;

describe('callStatusText', () => {
  it('bosqichlar', () => {
    expect(callStatusText(base, 0)).toBe('Qo\'ng\'iroq qilinmoqda…');
    expect(callStatusText({ ...base, remoteRinging: true }, 0)).toBe('Jiringlamoqda…');
    expect(callStatusText({ ...base, phase: 'ringing', direction: 'incoming', media: 'video' }, 0)).toBe('Kiruvchi video qo\'ng\'iroq');
    expect(callStatusText({ ...base, phase: 'connecting' }, 0)).toBe('Ulanmoqda…');
    expect(callStatusText({ ...base, phase: 'connected', connectedAt: 1_000 }, 193_500)).toBe('3:12');
    expect(callStatusText({ ...base, phase: 'connected', connectedAt: 1_000, reconnecting: true }, 5_000)).toBe('Aloqa tiklanmoqda…');
  });

  it('tugash sababi; xato matni', () => {
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'busy' }, 0)).toBe('Band');
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'missed' }, 0)).toBe('Javob bermadi');
    expect(callStatusText({ ...base, phase: 'ended', endReason: 'error', error: 'Mikrofonga ruxsat berilmadi' }, 0)).toBe(
      'Mikrofonga ruxsat berilmadi',
    );
  });
});

describe('isSilentEnd', () => {
  it('faqat javob berilmagan kiruvchi', () => {
    const ended = { ...base, phase: 'ended' as const, direction: 'incoming' as const };
    expect(isSilentEnd({ ...ended, endReason: 'cancelled' })).toBe(true);
    expect(isSilentEnd({ ...ended, endReason: 'answered_elsewhere' })).toBe(true);
    expect(isSilentEnd({ ...ended, endReason: 'hangup' })).toBe(false);
    expect(isSilentEnd({ ...ended, endReason: 'error' })).toBe(false);
    expect(isSilentEnd({ ...ended, direction: 'outgoing', endReason: 'rejected' })).toBe(false);
  });
});

describe('callToneFor', () => {
  it('kiruvchi jiringlash — ring; chiquvchi kutish — ringback; qolgan hamma holatda — jim', () => {
    expect(callToneFor(null)).toBeNull();
    expect(callToneFor({ phase: 'ringing', direction: 'incoming' })).toBe('ring');
    expect(callToneFor({ phase: 'calling', direction: 'outgoing' })).toBe('ringback');
    for (const phase of ['idle', 'connecting', 'connected', 'ended'] as const) {
      expect(callToneFor({ phase, direction: 'incoming' })).toBeNull();
      expect(callToneFor({ phase, direction: 'outgoing' })).toBeNull();
    }
  });
});
