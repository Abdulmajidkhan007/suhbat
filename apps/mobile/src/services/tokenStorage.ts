import type { TokenStorage } from '@suhbat/client';
import { TokenPairSchema } from '@suhbat/core';
import type { TokenPair } from '@suhbat/core';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'uz.suhbat.tokens';
const ACCOUNT = 'suhbat';

const parse = (raw: string): TokenPair | null => {
  try {
    const result = TokenPairSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

/**
 * Tokenlar iOS Keychain / Android Keystore'da (`react-native-keychain`).
 * Xotirada kesh ham bor: `@suhbat/client` refresh paytida tokenni tez-tez o'qiydi.
 */
export const keychainTokenStorage = (): TokenStorage => {
  let cache: TokenPair | null | undefined;

  return {
    async get() {
      if (cache !== undefined) return cache;
      const creds = await Keychain.getGenericPassword({ service: SERVICE });
      cache = creds ? parse(creds.password) : null;
      return cache;
    },
    async set(tokens) {
      cache = tokens;
      await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(tokens), {
        service:    SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
    async clear() {
      cache = null;
      await Keychain.resetGenericPassword({ service: SERVICE });
    },
  };
};
