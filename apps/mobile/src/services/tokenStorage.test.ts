import * as Keychain from 'react-native-keychain';
import { keychainTokenStorage } from './tokenStorage';

const pair = { accessToken: 'a1', refreshToken: 'r1' };

describe('keychainTokenStorage', () => {
  beforeEach(async () => {
    await Keychain.resetGenericPassword();
    jest.clearAllMocks();
  });

  it('saqlaydi, o\'qiydi va o\'chiradi (Keychain orqali)', async () => {
    await keychainTokenStorage().set(pair);
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('suhbat', JSON.stringify(pair), expect.objectContaining({
      service: 'uz.suhbat.tokens',
    }));
    // Yangi nusxa (ilova qayta ochilgandek) — Keychain'dan o'qiydi.
    const fresh = keychainTokenStorage();
    expect(await fresh.get()).toEqual(pair);
    await fresh.clear();
    expect(await keychainTokenStorage().get()).toBeNull();
  });

  it('buzilgan qiymat — null', async () => {
    await Keychain.setGenericPassword('suhbat', '{"accessToken":1}');
    expect(await keychainTokenStorage().get()).toBeNull();
    await Keychain.setGenericPassword('suhbat', 'not-json');
    expect(await keychainTokenStorage().get()).toBeNull();
  });

  it('xotira keshi: ikkinchi get Keychain\'ga bormaydi', async () => {
    const storage = keychainTokenStorage();
    await storage.get();
    await storage.get();
    expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
  });
});
