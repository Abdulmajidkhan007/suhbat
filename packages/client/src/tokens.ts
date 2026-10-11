import type { TokenPair } from '@suhbat/core';

/**
 * Tokenlar qayerda saqlanishi platformaga bog'liq: veb — localStorage,
 * mobil — Keychain/Keystore. Metodlar sinxron yoki asinxron bo'lishi mumkin.
 */
export interface TokenStorage {
  get(): TokenPair | null | Promise<TokenPair | null>;
  set(tokens: TokenPair): void | Promise<void>;
  clear(): void | Promise<void>;
}

export const memoryTokenStorage = (initial: TokenPair | null = null): TokenStorage => {
  let tokens = initial;
  return {
    get:   () => tokens,
    set:   (t) => { tokens = t; },
    clear: () => { tokens = null; },
  };
};

/** Brauzer (veb, Electron) uchun. Kalit — `suhbat.tokens`. */
export const webTokenStorage = (storage: Storage, key = 'suhbat.tokens'): TokenStorage => ({
  get: () => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const t = JSON.parse(raw) as Partial<TokenPair>;
      return typeof t.accessToken === 'string' && typeof t.refreshToken === 'string'
        ? { accessToken: t.accessToken, refreshToken: t.refreshToken }
        : null;
    } catch {
      return null;
    }
  },
  set:   (t) => storage.setItem(key, JSON.stringify(t)),
  clear: () => storage.removeItem(key),
});
