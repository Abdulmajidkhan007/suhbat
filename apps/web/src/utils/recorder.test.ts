import { describe, expect, it } from 'vitest';
import { pickRecorderMime, recorderErrorMessage } from './recorder';

describe('pickRecorderMime', () => {
  it('birinchi qo\'llab-quvvatlanadigan formatni tanlaydi', () => {
    expect(pickRecorderMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime((m) => m === 'audio/mp4')).toBe('audio/mp4'); // Safari
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('recorderErrorMessage', () => {
  it('ruxsat, mikrofon yo\'q va boshqa xatolar', () => {
    expect(recorderErrorMessage(new DOMException('x', 'NotAllowedError'))).toContain('ruxsat');
    expect(recorderErrorMessage(new DOMException('x', 'NotFoundError'))).toContain('topilmadi');
    expect(recorderErrorMessage(new Error('x'))).toContain('yozib bo');
  });
});
