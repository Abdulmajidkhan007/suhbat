import * as Keychain from 'react-native-keychain';

/**
 * Kichik ilova sozlamalari (tema, asosiy rang) — qurilmada saqlanadi.
 * Alohida native kutubxona qo'shmaslik uchun mavjud Keychain/Keystore'dan foydalaniladi
 * (tokenlardan alohida `service`). Maxfiy emas; o'qib bo'lmasa — standart qiymatlar.
 */
const SERVICE = 'uz.suhbat.prefs';
const ACCOUNT = 'prefs';

export interface PrefsStorage {
  load: () => Promise<Record<string, unknown>>;
  save: (prefs: Record<string, unknown>) => Promise<void>;
}

export const keychainPrefsStorage: PrefsStorage = {
  async load() {
    try {
      const creds = await Keychain.getGenericPassword({ service: SERVICE });
      if (!creds) return {};
      const parsed: unknown = JSON.parse(creds.password);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  },
  async save(prefs) {
    try {
      await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(prefs), { service: SERVICE });
    } catch {
      // Saqlab bo'lmasa — joriy sessiyada ishlayveradi.
    }
  },
};
