import type { TokenStorage } from './tokens.js';

/**
 * Electron preload `window.suhbatDesktop` sifatida beradigan minimal ko'prik.
 * Veb ilova uni topsa, tokenlarni `localStorage` o'rniga OS xavfsiz saqlashida
 * (Electron `safeStorage`) saqlaydi. Brauzerda `window.suhbatDesktop` yo'q.
 */
export interface DesktopBridge {
  readonly platform: string;
  readonly tokens: TokenStorage;
}

declare global {
  interface Window {
    suhbatDesktop?: DesktopBridge;
  }
}
