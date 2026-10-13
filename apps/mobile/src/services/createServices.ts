import { createApiClient, createSocketClient } from '@suhbat/client';
import type { ApiClient, SocketClient, TokenStorage } from '@suhbat/client';
import { API_URL } from '../config/env';
import { createFirebasePush } from './push';
import type { PushPlatform } from './push';
import { keychainTokenStorage } from './tokenStorage';

export interface Services {
  api:    ApiClient;
  socket: SocketClient;
  push:   PushPlatform;
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
  return { api, socket, push: createFirebasePush() };
};
