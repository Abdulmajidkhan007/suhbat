import type { TokenPair } from '@suhbat/core';

/** OS xavfsiz saqlashi (Electron `safeStorage`) uchun minimal interfeys — testda almashtiriladi. */
export interface Cipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

/** Shifrlangan baytlar saqlanadigan joy (fayl). */
export interface BlobFile {
  read(): Buffer | null;
  write(data: Buffer): void;
  remove(): void;
}

export interface TokenVault {
  get(): TokenPair | null;
  set(tokens: TokenPair): void;
  clear(): void;
}

export const isTokenPair = (v: unknown): v is TokenPair =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as TokenPair).accessToken === 'string' &&
  typeof (v as TokenPair).refreshToken === 'string' &&
  (v as TokenPair).accessToken.length > 0 &&
  (v as TokenPair).refreshToken.length > 0;

/**
 * Tokenlar faqat shifrlangan holda diskka yoziladi. Shifrlash mavjud bo'lmasa
 * (masalan Linux'da kalit ombori yo'q) **ochiq matn yozilmaydi** — `set` hech
 * narsa saqlamaydi va foydalanuvchi har ishga tushirishda qayta kiradi.
 */
export const createTokenVault = (cipher: Cipher, file: BlobFile): TokenVault => ({
  get() {
    if (!cipher.isAvailable()) return null;
    const blob = file.read();
    if (!blob) return null;
    try {
      const parsed: unknown = JSON.parse(cipher.decrypt(blob));
      return isTokenPair(parsed) ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } : null;
    } catch {
      file.remove(); // buzilgan yoki boshqa kalit bilan shifrlangan — foydasiz
      return null;
    }
  },
  set(tokens) {
    if (!cipher.isAvailable()) return;
    file.write(cipher.encrypt(JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })));
  },
  clear() {
    file.remove();
  },
});
