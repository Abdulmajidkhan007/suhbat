import { describe, expect, it } from 'vitest';
import { normalizeApiUrl } from './url.js';

describe('normalizeApiUrl', () => {
  it("to'liq manzil o'zgarmaydi, oxiridagi / va bo'sh joy olib tashlanadi", () => {
    expect(normalizeApiUrl(' https://api.suhbat.uz// ')).toBe('https://api.suhbat.uz');
    expect(normalizeApiUrl('http://10.0.2.2:4000')).toBe('http://10.0.2.2:4000');
    expect(normalizeApiUrl('HTTPS://API.SUHBAT.UZ/v1/')).toBe('HTTPS://API.SUHBAT.UZ/v1');
  });

  it("sxemasiz hostga https:// qo'shiladi", () => {
    expect(normalizeApiUrl('suhbatapi-production.up.railway.app')).toBe(
      'https://suhbatapi-production.up.railway.app',
    );
    expect(normalizeApiUrl('api.suhbat.uz/')).toBe('https://api.suhbat.uz');
    expect(normalizeApiUrl('//api.suhbat.uz')).toBe('https://api.suhbat.uz');
    expect(normalizeApiUrl('localhost:4000')).toBe('https://localhost:4000');
  });

  it("bo'sh qiymat bo'sh qoladi", () => {
    expect(normalizeApiUrl('   ')).toBe('');
  });
});
