import { createMessageNotifier } from '@suhbat/client';
import type { ApiClient, SocketClient } from '@suhbat/client';
import type { ConnectionKeeper } from '../services/connectionKeeper';
import type { BackgroundNative } from './native';

/** UI holati: ilova ko'rinib turibdimi. */
export interface UiState {
  isForeground(): boolean;
}

export { callNotificationTag as callTag, NOTIFICATION_SETTINGS_TTL_MS as SETTINGS_TTL_MS } from '@suhbat/client';

/**
 * Android: FCM'siz bildirishnomalar. Kirgan foydalanuvchi uchun socket'dagi `message:new` /
 * `call:invite` ni ilova ko'rinmay turganda mahalliy bildirishnoma qilib ko'rsatadi (server
 * socket'i bor foydalanuvchiga FCM yubormaydi — dublikat bo'lmaydi). Sozlamada "fonda ulanib
 * turish" yoqilgan bo'lsa, foreground service jarayonni va ulanishni tirik saqlaydi.
 *
 * `sync()` — holatni qayta o'qiydi (ishga tushish, kirish/chiqish, sozlama o'zgarishi).
 */
export interface BackgroundController {
  readonly available: boolean;
  /** Native qism (bildirishnomani tozalash, batareya sozlamasi, bosilgan chat). */
  readonly native: BackgroundNative;
  sync(): Promise<void>;
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  /** Chiqish / sessiya tugadi: hammasi to'xtaydi (sozlama saqlanadi). */
  stop(): void;
}

interface Deps {
  api:        Pick<ApiClient, 'hasSession' | 'me' | 'getChat' | 'getNotificationSettings'>;
  socket:     Pick<SocketClient, 'on' | 'onConnectionChange'>;
  connection: ConnectionKeeper;
  native:     BackgroundNative;
  ui:         UiState;
  now?:       () => number;
}

export const createBackgroundController = ({ api, socket, connection, native, ui, now }: Deps): BackgroundController => {
  let listening: (() => void) | null = null;
  let release: (() => void) | null = null;
  let generation = 0;

  const listen = () => {
    listening ??= createMessageNotifier({
      api,
      socket,
      // Ilova ochiq bo'lsa (UI o'qilmaganlar sonini ko'rsatadi) — bildirishnoma yo'q.
      isSeen:  () => ui.isForeground(),
      show:    (n) => native.showNotification({
        tag: n.tag, channel: n.kind === 'call' ? 'calls' : 'messages', title: n.title, body: n.body, chatId: n.chatId,
      }),
      cancel:  (tag) => native.cancelNotification(tag),
      onError: (e) => console.warn('fon bildirishnomasi', e),
      now,
    });
  };

  const stop = () => {
    generation += 1;
    listening?.();
    listening = null;
    release?.();
    release = null;
    native.stopService();
  };

  const sync = async () => {
    if (!native.available) return;
    const gen = ++generation;
    const [signedIn, enabled] = await Promise.all([api.hasSession(), native.isEnabled()]);
    if (gen !== generation) return; // orada boshqa sync/stop
    if (!signedIn) {
      stop();
      return;
    }
    listen();
    if (enabled) {
      release ??= connection.hold();
      await native.startService().catch((e: unknown) => console.warn('fon ulanishi boshlanmadi', e));
    } else {
      release?.();
      release = null;
      native.stopService();
    }
  };

  return {
    get available() {
      return native.available;
    },
    native,
    sync,
    isEnabled: () => native.isEnabled(),
    async setEnabled(enabled) {
      await native.setEnabled(enabled);
      await sync();
    },
    stop,
  };
};
