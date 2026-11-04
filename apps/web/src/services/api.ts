// Bitta API va WebSocket mijozi (`@suhbat/client`) — butun ilova uchun.
import { createApiClient, createSocketClient, normalizeApiUrl, webRefreshLock, webTokenStorage } from '@suhbat/client';

// Sxemasiz host (`api.suhbat.uz`) berilsa `https://` qo'shiladi — aks holda so'rov nisbiy yo'lga ketadi.
export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL || 'http://localhost:4000');

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
  // Tablar/Electron oynalari orasida bitta refresh (Web Locks) — REJA 5.1.
  lock:             webRefreshLock(),
});

export const socket = createSocketClient({
  url:                API_URL,
  getAccessToken:     api.getAccessToken,
  refreshAccessToken: api.refreshAccessToken,
  onUnauthorized:     () => sessionExpired(),
});
