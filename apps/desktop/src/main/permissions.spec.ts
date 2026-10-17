import { describe, expect, it } from 'vitest';
import { isMediaPermissionAllowed, isPermissionAllowed } from './permissions';

describe('isMediaPermissionAllowed', () => {
  it('o\'z sahifasiga mikrofon va kamera', () => {
    expect(isMediaPermissionAllowed('media', true, ['audio'])).toBe(true);
    expect(isMediaPermissionAllowed('media', true, ['audio', 'video'])).toBe(true);
    expect(isMediaPermissionAllowed('media', true)).toBe(true);
  });

  it('begona sahifa va boshqa ruxsatlar — rad', () => {
    expect(isMediaPermissionAllowed('media', false, ['audio'])).toBe(false);
    expect(isMediaPermissionAllowed('geolocation', true)).toBe(false);
    expect(isMediaPermissionAllowed('notifications', true)).toBe(false);
    expect(isMediaPermissionAllowed('display-capture', true)).toBe(false);
    expect(isMediaPermissionAllowed('media', true, ['audio', 'screen'])).toBe(false);
  });
});

describe('isPermissionAllowed', () => {
  it('bildirishnoma — faqat o\'z sahifasiga; media qoidasi o\'zgarmaydi', () => {
    expect(isPermissionAllowed('notifications', true)).toBe(true);
    expect(isPermissionAllowed('notifications', false)).toBe(false);
    expect(isPermissionAllowed('media', true, ['audio'])).toBe(true);
    expect(isPermissionAllowed('media', true, ['screen'])).toBe(false);
    expect(isPermissionAllowed('geolocation', true)).toBe(false);
  });
});
