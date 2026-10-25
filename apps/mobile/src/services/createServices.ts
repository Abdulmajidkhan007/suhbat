import { createApiClient, createCallManager, createSocketClient } from '@suhbat/client';
import type { ApiClient, CallManager, SocketClient, TokenStorage } from '@suhbat/client';
import InCallManager from 'react-native-incall-manager';
import type { MediaStream } from 'react-native-webrtc';
import { createBackgroundController } from '../background/controller';
import type { BackgroundController } from '../background/controller';
import { createBackgroundNative } from '../background/native';
import { appUiState } from '../background/uiState';
import { createCallAudio } from '../calls/callAudio';
import type { CallAudio } from '../calls/callAudio';
import { createNativePeer, nativeMediaDevices } from '../calls/nativeWebrtc';
import { API_URL } from '../config/env';
import { createConnectionKeeper } from './connectionKeeper';
import type { ConnectionKeeper } from './connectionKeeper';
import { createFirebasePush } from './push';
import type { PushPlatform } from './push';
import { keychainTokenStorage } from './tokenStorage';

export interface Services {
  api:    ApiClient;
  socket: SocketClient;
  push:   PushPlatform;
  /** 1:1 qo'ng'iroqlar (WebRTC). */
  calls:  CallManager<MediaStream>;
  /** Jiringlash, kutish ovozi, karnay/quloqchin (`react-native-incall-manager`). */
  callAudio: CallAudio;
  /** Socket ulanishi egalari: UI va fon ulanishi. */
  connection: ConnectionKeeper;
  /** Android: FCM'siz bildirishnomalar va fon ulanishi. */
  background: BackgroundController;
}

export interface ServicesOptions {
  /** Refresh token ham yaroqsiz — foydalanuvchi qayta kirishi kerak. */
  onSessionExpired: () => void;
  baseUrl?: string;
  storage?: TokenStorage;
}

export const createServices = ({ onSessionExpired, baseUrl = API_URL, storage }: ServicesOptions): Services => {
  const api = createApiClient({ baseUrl, storage: storage ?? keychainTokenStorage(), onSessionExpired });
  const socket = createSocketClient({
    url:                baseUrl,
    getAccessToken:     api.getAccessToken,
    refreshAccessToken: api.refreshAccessToken,
    onUnauthorized:     onSessionExpired,
  });
  const calls = createCallManager<MediaStream>({
    events:        socket,
    signaling:     socket,
    media:         nativeMediaDevices(),
    createPeer:    createNativePeer,
    getIceServers: async () => (await api.getIceServers()).iceServers,
  });
  const callAudio = createCallAudio(InCallManager);
  calls.subscribe(callAudio.sync);
  const connection = createConnectionKeeper(socket);
  const background = createBackgroundController({
    api, socket, connection, native: createBackgroundNative(), ui: appUiState,
  });
  return { api, socket, push: createFirebasePush(), calls, callAudio, connection, background };
};

const expiredListeners = new Set<() => void>();
let appServices: Services | null = null;

/**
 * Ilova bo'ylab bitta nusxa: UI (`SessionProvider`) va oynasiz fon ishga tushishi
 * (`index.js`, foreground service) bir xil socket'ni ishlatadi — ikkinchi ulanish ochilmaydi.
 */
export const getAppServices = (): Services => {
  appServices ??= createServices({
    onSessionExpired: () => {
      appServices?.background.stop();
      expiredListeners.forEach((l) => l());
    },
  });
  return appServices;
};

/** Refresh token ham yaroqsiz bo'lganda (UI kirish ekraniga qaytadi). */
export const onAppSessionExpired = (listener: () => void): (() => void) => {
  expiredListeners.add(listener);
  return () => void expiredListeners.delete(listener);
};
