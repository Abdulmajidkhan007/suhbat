import { describe, expect, it } from 'vitest';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  it('birinchi ulanish va oxirgi uzilishni aniqlaydi (bir nechta tab)', () => {
    const p = new PresenceService();
    expect(p.connect('u1', 's1')).toBe(true);
    expect(p.connect('u1', 's2')).toBe(false);
    expect(p.isOnline('u1')).toBe(true);
    expect(p.disconnect('u1', 's1')).toBe(false);
    expect(p.isOnline('u1')).toBe(true);
    expect(p.disconnect('u1', 's2')).toBe(true);
    expect(p.isOnline('u1')).toBe(false);
  });

  it('noma\'lum socket uzilishi — o\'zgarish yo\'q', () => {
    const p = new PresenceService();
    expect(p.disconnect('u1', 's1')).toBe(false);
    p.connect('u1', 's1');
    expect(p.disconnect('u1', 'boshqa')).toBe(false);
    expect(p.isOnline('u1')).toBe(true);
  });
});
