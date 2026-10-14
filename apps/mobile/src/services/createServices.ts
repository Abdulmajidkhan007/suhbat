import { createApiClient, createCallManager, createSocketClient } from '@suhbat/client';
import type { ApiClient, CallManager, SocketClient, TokenStorage } from '@suhbat/client';
import type { MediaStream } from 'react-native-webrtc';
import { createNativePeer, nativeMediaDevices } from '../calls/nativeWebrtc';
import { API_URL } from '../config/env';
import { createFirebasePush } from './push';
import type { PushPlatform } from './push';
import { keychainTokenStorage } from './tokenStorage';

export interface Services {
  api:    ApiClient;
  socket: SocketClient;
  push:   PushPlatform;
  /** 1:1 qo'ng'iroqlar (WebRTC). */
  calls:  CallManager<MediaStream>;
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
  return { api, socket, push: createFirebasePush(), calls };
};
