import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export type NotificationChannel = 'messages' | 'calls';

export interface LocalNotification {
  /** Bir xil `tag` — oldingisini almashtiradi (xabar: chatId, qo'ng'iroq: `call:<callId>`). */
  tag:     string;
  channel: NotificationChannel;
  title:   string;
  body:    string;
  /** Bosilganda ochiladigan chat. */
  chatId:  string;
}

/**
 * Android native qismi (`android/.../background/`): foreground service, mahalliy
 * bildirishnomalar, batareya optimizatsiyasi. iOS va testlarda — `disabledBackgroundNative`.
 */
export interface BackgroundNative {
  readonly available: boolean;
  /** Sozlama: fonda ulanib turish (qurilmada saqlanadi, qayta yoqilganda ham). */
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  startService(): Promise<void>;
  stopService(): void;
  showNotification(n: LocalNotification): void;
  cancelNotification(tag: string): void;
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): void;
  /** Bildirishnoma bosilib ochilgan chat (bir marta beriladi). */
  consumeOpenChat(): Promise<string | null>;
  /** Ilova ochiq paytda bildirishnoma bosildi — keyin `consumeOpenChat`. */
  onOpenChatRequest(listener: () => void): () => void;
}

const noop = () => undefined;

export const disabledBackgroundNative: BackgroundNative = {
  available:                         false,
  isEnabled:                         async () => false,
  setEnabled:                        async () => undefined,
  startService:                      async () => undefined,
  stopService:                       noop,
  showNotification:                  noop,
  cancelNotification:                noop,
  isIgnoringBatteryOptimizations:    async () => true,
  requestIgnoreBatteryOptimizations: noop,
  consumeOpenChat:                   async () => null,
  onOpenChatRequest:                 () => noop,
};

interface NativeSpec {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  startService(): Promise<void>;
  stopService(): void;
  showNotification(tag: string, channel: string, title: string, body: string, chatId: string): void;
  cancelNotification(tag: string): void;
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): void;
  consumeOpenChat(): Promise<string | null>;
}

const OPEN_CHAT_EVENT = 'suhbatOpenChat';

export const createBackgroundNative = (): BackgroundNative => {
  const mod = (NativeModules as { SuhbatBackground?: NativeSpec }).SuhbatBackground;
  if (Platform.OS !== 'android' || !mod) return disabledBackgroundNative;
  return {
    available:                         true,
    isEnabled:                         () => mod.isEnabled(),
    setEnabled:                        (enabled) => mod.setEnabled(enabled),
    startService:                      () => mod.startService(),
    stopService:                       () => mod.stopService(),
    showNotification:                  (n) => mod.showNotification(n.tag, n.channel, n.title, n.body, n.chatId),
    cancelNotification:                (tag) => mod.cancelNotification(tag),
    isIgnoringBatteryOptimizations:    () => mod.isIgnoringBatteryOptimizations(),
    requestIgnoreBatteryOptimizations: () => mod.requestIgnoreBatteryOptimizations(),
    consumeOpenChat:                   () => mod.consumeOpenChat(),
    onOpenChatRequest:                 (listener) => {
      const sub = DeviceEventEmitter.addListener(OPEN_CHAT_EVENT, listener);
      return () => sub.remove();
    },
  };
};
