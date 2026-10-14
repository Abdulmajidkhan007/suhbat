import { describe, expect, it } from 'vitest';
import { isMediaPermissionAllowed } from './permissions';

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
