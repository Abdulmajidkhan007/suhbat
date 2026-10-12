import { defaultApiUrl, normalizeApiUrl } from './env';

describe('API manzili', () => {
  it('Android emulyator — 10.0.2.2, iOS — localhost', () => {
    expect(defaultApiUrl('android')).toBe('http://10.0.2.2:4000');
    expect(defaultApiUrl('ios')).toBe('http://localhost:4000');
  });

  it('oxiridagi / olib tashlanadi', () => {
    expect(normalizeApiUrl(' https://api.suhbat.uz// ')).toBe('https://api.suhbat.uz');
  });
});
