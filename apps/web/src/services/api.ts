// Bitta API va WebSocket mijozi (`@suhbat/client`) — butun ilova uchun.
import { createApiClient, createSocketClient, webTokenStorage } from '@suhbat/client';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

let sessionExpired: () => void = () => {};
/** Sessiya tugaganda (refresh ham yaroqsiz) nima qilish — `useAuth` o'rnatadi. */
export const setSessionExpiredHandler = (fn: () => void) => {
  sessionExpired = fn;
};

export const api = createApiClient({
  baseUrl:          API_URL,
  // Electron'da — OS xavfsiz saqlash (preload ko'prigi), brauzerda — localStorage.
  storage:          window.suhbatDesktop?.tokens ?? webTokenStorage(window.localStorage),
  onSessionExpired: () => sessionExpired(),
});

export const socket = createSocketClient({
  url:                API_URL,
  getAccessToken:     api.getAccessToken,
  refreshAccessToken: api.refreshAccessToken,
  onUnauthorized:     () => sessionExpired(),
});
