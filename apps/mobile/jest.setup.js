jest.mock('react-native-keychain', () => {
  let stored = null;
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    setGenericPassword: jest.fn(async (username, password) => {
      stored = { username, password };
      return { service: 'test', storage: 'test' };
    }),
    getGenericPassword: jest.fn(async () => stored ?? false),
    resetGenericPassword: jest.fn(async () => {
      stored = null;
      return true;
    }),
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
