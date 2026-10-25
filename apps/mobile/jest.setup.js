jest.mock('react-native-keychain', () => {
  // `service` bo'yicha alohida (tokenlar va sozlamalar bir-birini bosib ketmasin).
  const stored = new Map();
  const key = (options) => options?.service ?? 'default';
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    setGenericPassword: jest.fn(async (username, password, options) => {
      stored.set(key(options), { username, password });
      return { service: key(options), storage: 'test' };
    }),
    getGenericPassword: jest.fn(async (options) => stored.get(key(options)) ?? false),
    resetGenericPassword: jest.fn(async (options) => (options?.service ? stored.delete(options.service) : (stored.clear(), true))),
  };
});

jest.mock('@react-native-clipboard/clipboard', () => ({ setString: jest.fn(), getString: jest.fn(async () => '') }));
jest.mock('react-native-haptic-feedback', () => ({ __esModule: true, trigger: jest.fn() }));

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

jest.mock('react-native-incall-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(), stop: jest.fn(), startRingtone: jest.fn(), stopRingtone: jest.fn(),
    stopRingback: jest.fn(), setForceSpeakerphoneOn: jest.fn(),
  },
}));

// react-native-webrtc native moduli testlarda yo'q: oddiy o'rinbosarlar (qo'ng'iroq mantiqi
// `@suhbat/client` da soxta peer bilan sinaladi, bu yerda — faqat UI).
jest.mock('react-native-webrtc', () => {
  const { View } = require('react-native');
  const RTCView = (props) => require('react').createElement(View, { testID: 'rtc-view', ...props });
  return {
    RTCView,
    RTCPeerConnection: jest.fn(),
    MediaStream:       jest.fn(),
    mediaDevices:      { getUserMedia: jest.fn() },
  };
});
