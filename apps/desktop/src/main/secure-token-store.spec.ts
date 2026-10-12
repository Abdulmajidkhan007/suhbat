import { describe, expect, it } from 'vitest';
import { createTokenVault } from './secure-token-store';
import type { BlobFile, Cipher } from './secure-token-store';

const tokens = { accessToken: 'acc', refreshToken: 'ref' };

const setup = (available = true) => {
  let blob: Buffer | null = null;
  const file: BlobFile = {
    read:   () => blob,
    write:  (b) => { blob = b; },
    remove: () => { blob = null; },
  };
  // Soxta "shifr": base64 teskari — ochiq matn diskka tushmasligini tekshirish uchun yetarli.
  const cipher: Cipher = {
    isAvailable: () => available,
    encrypt:     (s) => Buffer.from(Buffer.from(s).toString('base64').split('').reverse().join('')),
    decrypt:     (b) => Buffer.from(b.toString().split('').reverse().join(''), 'base64').toString(),
  };
  return { vault: createTokenVault(cipher, file), peek: () => blob };
};

describe('createTokenVault', () => {
  it('set → get aylanadi; diskdagi baytlarda token ochiq matnda yo\'q', () => {
    const { vault, peek } = setup();
    vault.set(tokens);
    expect(vault.get()).toEqual(tokens);
    expect(peek()!.toString()).not.toContain('acc');
  });

  it('clear o\'chiradi', () => {
    const { vault } = setup();
    vault.set(tokens);
    vault.clear();
    expect(vault.get()).toBeNull();
  });

  it('shifrlash mavjud emas: hech narsa yozilmaydi (ochiq matn zaxirasi yo\'q)', () => {
    const { vault, peek } = setup(false);
    vault.set(tokens);
    expect(peek()).toBeNull();
    expect(vault.get()).toBeNull();
  });

  it('buzilgan blob: null qaytaradi va o\'chiradi', () => {
    const { vault, peek } = setup();
    vault.set(tokens);
    // boshqa kalit bilan shifrlangandek
    const broken = setup();
    broken.vault.set({ accessToken: 'a', refreshToken: 'b' });
    const cipherThrows: Cipher = { isAvailable: () => true, encrypt: () => Buffer.from('x'), decrypt: () => { throw new Error('bad'); } };
    let blob: Buffer | null = Buffer.from('zzz');
    const v = createTokenVault(cipherThrows, { read: () => blob, write: (b) => { blob = b; }, remove: () => { blob = null; } });
    expect(v.get()).toBeNull();
    expect(blob).toBeNull();
    expect(peek()).not.toBeNull();
  });

  it('noto\'g\'ri shakldagi JSON rad etiladi', () => {
    let blob: Buffer | null = Buffer.from('{"accessToken":1}');
    const cipher: Cipher = { isAvailable: () => true, encrypt: (s) => Buffer.from(s), decrypt: (b) => b.toString() };
    const v = createTokenVault(cipher, { read: () => blob, write: (b) => { blob = b; }, remove: () => { blob = null; } });
    expect(v.get()).toBeNull();
  });
});
