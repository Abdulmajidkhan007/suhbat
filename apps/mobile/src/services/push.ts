import { getApps } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PushDataSchema } from '@suhbat/core';
import type { DevicePlatform, PushData } from '@suhbat/core';
import { PermissionsAndroid, Platform } from 'react-native';

/** Ilova ochiq paytda kelgan bildirishnoma (in-app banner uchun). */
export interface ForegroundPush {
  title: string;
  body:  string;
  data:  PushData;
}

/**
 * Push platformasi (FCM) — ilova shu interfeys orqali ishlaydi, testlarda soxtasi.
 * Firebase sozlanmagan bo'lsa (`google-services.json` / `GoogleService-Info.plist` yo'q)
 * `available === false` va hamma metodlar hech narsa qilmaydi.
 */
export interface PushPlatform {
  readonly available: boolean;
  readonly platform:  DevicePlatform;
  /** Ruxsat so'raydi (Android 13+ `POST_NOTIFICATIONS`, iOS). `true` — berildi. */
  requestPermission(): Promise<boolean>;
  getToken(): Promise<string | null>;
  deleteToken(): Promise<void>;
  onTokenRefresh(listener: (token: string) => void): () => void;
  onForegroundMessage(listener: (push: ForegroundPush) => void): () => void;
  /** Fon holatidagi ilovada bildirishnoma bosildi. */
  onNotificationOpened(listener: (data: PushData) => void): () => void;
  /** Ilova bildirishnomani bosish bilan (yopiq holatdan) ochilgan bo'lsa — uning ma'lumoti. */
  getInitialNotification(): Promise<PushData | null>;
}

/** FCM `data` qismini tekshiradi: begona/eski formatdagi bildirishnoma e'tiborsiz qoldiriladi. */
export const parsePushData = (message: { data?: unknown } | null): PushData | null => {
  const parsed = PushDataSchema.safeParse(message?.data);
  return parsed.success ? parsed.data : null;
};

const noop = () => undefined;

export const disabledPush = (platform: DevicePlatform): PushPlatform => ({
  available:              false,
  platform,
  requestPermission:      async () => false,
  getToken:               async () => null,
  deleteToken:            async () => undefined,
  onTokenRefresh:         () => noop,
  onForegroundMessage:    () => noop,
  onNotificationOpened:   () => noop,
  getInitialNotification: async () => null,
});

const currentPlatform = (): DevicePlatform => (Platform.OS === 'ios' ? 'ios' : 'android');

/** Firebase native sozlangan bo'lsa (`FirebaseApp` bor). */
const firebaseConfigured = (): boolean => {
  try {
    return getApps().length > 0;
  } catch {
    return false; // native modul yo'q (masalan, testlar)
  }
};

export const createFirebasePush = (): PushPlatform => {
  const platform = currentPlatform();
  if (!firebaseConfigured()) return disabledPush(platform);
  const messaging = getMessaging();
  // Boshlang'ich bildirishnoma bir marta ishlatiladi (qayta kirishda chat yana ochilmasin).
  let initialConsumed = false;

  return {
    available: true,
    platform,

    async requestPermission() {
      if (Platform.OS === 'android') {
        // Android 12 va pastda ruxsat o'rnatishda beriladi.
        if (Number(Platform.Version) < 33) return true;
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      const status = await requestPermission(messaging);
      return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
    },

    getToken: () => getToken(messaging),
    deleteToken: () => deleteToken(messaging),
    onTokenRefresh: (listener) => onTokenRefresh(messaging, listener),

    onForegroundMessage: (listener) =>
      onMessage(messaging, (message) => {
        const data = parsePushData(message);
        if (!data) return;
        listener({ title: message.notification?.title ?? 'Suhbat', body: message.notification?.body ?? '', data });
      }),

    onNotificationOpened: (listener) =>
      onNotificationOpenedApp(messaging, (message) => {
        const data = parsePushData(message);
        if (data) listener(data);
      }),

    async getInitialNotification() {
      if (initialConsumed) return null;
      initialConsumed = true;
      return parsePushData(await getInitialNotification(messaging));
    },
  };
};

/**
 * `index.js` dan, `AppRegistry` dan oldin: fon xabarlari uchun ishlovchi (Android talab qiladi).
 * Bildirishnomani tizim o'zi ko'rsatadi (`notification` bloki), shu yerda qo'shimcha ish yo'q.
 */
export const registerBackgroundHandler = (): void => {
  if (!firebaseConfigured()) return;
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
};
