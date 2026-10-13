import type { PushData } from '@suhbat/core';
import type { ForegroundPush, PushPlatform } from '../services/push';

/** Testlar uchun soxta FCM: `foreground` / `open` — tizimdan kelgandek. */
export const createFakePush = (opts: { token?: string; granted?: boolean; initial?: PushData | null } = {}) => {
  const foreground = new Set<(p: ForegroundPush) => void>();
  const opened = new Set<(d: PushData) => void>();
  const refreshed = new Set<(t: string) => void>();
  const subscribe = <T>(set: Set<T>, l: T) => {
    set.add(l);
    return () => void set.delete(l);
  };

  const push: PushPlatform = {
    available:              true,
    platform:               'android',
    requestPermission:      jest.fn(async () => opts.granted ?? true),
    getToken:               jest.fn(async () => opts.token ?? 'fcm-token-1'),
    deleteToken:            jest.fn(async () => undefined),
    onTokenRefresh:         (l) => subscribe(refreshed, l),
    onForegroundMessage:    (l) => subscribe(foreground, l),
    onNotificationOpened:   (l) => subscribe(opened, l),
    getInitialNotification: jest.fn(async () => opts.initial ?? null),
  };

  return {
    push,
    foreground: (p: ForegroundPush) => foreground.forEach((l) => l(p)),
    open:       (d: PushData) => opened.forEach((l) => l(d)),
    refresh:    (t: string) => refreshed.forEach((l) => l(t)),
  };
};
