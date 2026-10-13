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

// Firebase native modullari testlarda yo'q: "sozlanmagan" holat (push o'chiq).
jest.mock('@react-native-firebase/app', () => ({ getApps: () => [] }));
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 },
  getMessaging:                jest.fn(),
  getToken:                    jest.fn(),
  deleteToken:                 jest.fn(),
  onMessage:                   jest.fn(() => () => undefined),
  onNotificationOpenedApp:     jest.fn(() => () => undefined),
  onTokenRefresh:              jest.fn(() => () => undefined),
  requestPermission:           jest.fn(),
  getInitialNotification:      jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
}));
