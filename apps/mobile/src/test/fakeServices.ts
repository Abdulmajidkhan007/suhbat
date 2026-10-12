import type { ApiClient, SocketClient } from '@suhbat/client';
import type { ServerToClientEvents } from '@suhbat/core';
import type { Services } from '../services/createServices';
import { ME } from './fixtures';

/** Server voqealarining hammasi bitta argumentli. */
type Listener = (payload: unknown) => void;

/**
 * Testlar uchun soxta API va socket: faqat ilova ishlatadigan metodlar.
 * `emit` — serverdan voqea kelgandek.
 */
export const createFakeServices = (api: Partial<ApiClient> = {}) => {
  const listeners = new Map<string, Set<Listener>>();
  const connectionListeners = new Set<(c: boolean) => void>();
  let connected = false;

  const fakeApi: Partial<ApiClient> = {
    hasSession:       jest.fn(async () => false),
    me:               jest.fn(async () => ME),
    login:            jest.fn(async () => ME),
    register:         jest.fn(async () => ME),
    logout:           jest.fn(async () => undefined),
    listChats:        jest.fn(async () => []),
    getChat:          jest.fn(async () => { throw new Error('topilmadi'); }),
    listMessages:     jest.fn(async () => ({ items: [], nextCursor: null })),
    searchUsers:      jest.fn(async () => []),
    ...api,
  };

  const fakeSocket: Partial<SocketClient> = {
    connect: jest.fn(() => {
      connected = true;
      connectionListeners.forEach((l) => l(true));
      return undefined;
    }),
    disconnect: jest.fn(() => {
      connected = false;
      return undefined;
    }),
    isConnected: () => connected,
    on: ((event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return () => set.delete(listener);
    }) as unknown as SocketClient['on'],
    onConnectionChange: (l) => {
      connectionListeners.add(l);
      return () => connectionListeners.delete(l);
    },
    sendMessage: jest.fn(),
    setTyping:   jest.fn(),
    markRead:    jest.fn(async () => ({ lastReadAt: new Date().toISOString() })),
  };

  const emit = <E extends keyof ServerToClientEvents>(event: E, payload: Parameters<ServerToClientEvents[E]>[0]) => {
    listeners.get(event)?.forEach((l) => l(payload));
  };

  // Ilova ishlatmaydigan metodlar yo'q — chaqirilsa test TypeError bilan yiqiladi.
  const services = { api: fakeApi, socket: fakeSocket } as unknown as Services;
  return { services, api: fakeApi, socket: fakeSocket, emit };
};
