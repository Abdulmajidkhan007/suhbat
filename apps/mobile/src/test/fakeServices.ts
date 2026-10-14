import { createCallManager } from '@suhbat/client';
import type { ApiClient, CallMediaDevices, CallSignaling, PeerConnection, SocketClient } from '@suhbat/client';
import type { MediaStream } from 'react-native-webrtc';
import type { ServerToClientEvents } from '@suhbat/core';
import type { Services } from '../services/createServices';
import { disabledPush } from '../services/push';
import type { PushPlatform } from '../services/push';
import { ME } from './fixtures';

/** Server voqealarining hammasi bitta argumentli. */
type Listener = (payload: unknown) => void;

/**
 * Testlar uchun soxta API va socket: faqat ilova ishlatadigan metodlar.
 * `emit` — serverdan voqea kelgandek.
 */
export const createFakeServices = (api: Partial<ApiClient> = {}, push: PushPlatform = disabledPush('android')) => {
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
    registerDevice:   jest.fn(async () => undefined),
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

  // Qo'ng'iroq: haqiqiy CallManager, signal/media/peer — soxta.
  const signaling: { [K in keyof CallSignaling]: jest.Mock } = {
    inviteCall:     jest.fn(async (p: { callId: string }) => ({ callId: p.callId })),
    callRinging:    jest.fn(),
    acceptCall:     jest.fn(async (callId: string) => ({ callId })),
    rejectCall:     jest.fn(async (callId: string) => ({ callId })),
    cancelCall:     jest.fn(async (callId: string) => ({ callId })),
    endCall:        jest.fn(async (callId: string) => ({ callId })),
    sendCallOffer:  jest.fn(),
    sendCallAnswer: jest.fn(),
    sendCallIce:    jest.fn(),
  };
  const fakeStream = { toURL: () => 'stream://local', getTracks: () => [] } as unknown as MediaStream;
  const media: CallMediaDevices<MediaStream> = {
    getLocalStream:  jest.fn(async () => fakeStream),
    stopStream:      jest.fn(),
    setAudioEnabled: jest.fn(),
    setVideoEnabled: jest.fn(),
  };
  const peer: PeerConnection<MediaStream> = {
    addStream:            jest.fn(),
    createOffer:          jest.fn(async () => ({ type: 'offer' as const, sdp: 'v=0' })),
    createAnswer:         jest.fn(async () => ({ type: 'answer' as const, sdp: 'v=0' })),
    setLocalDescription:  jest.fn(async () => undefined),
    setRemoteDescription: jest.fn(async () => undefined),
    addIceCandidate:      jest.fn(async () => undefined),
    close:                jest.fn(),
  };
  const calls = createCallManager<MediaStream>({
    events:        fakeSocket as SocketClient,
    signaling,
    media,
    createPeer:    () => peer,
    getIceServers: async () => [],
    // Qisqa, lekin sekin CI'da ham "tugadi" ekranini tekshirishga yetarli.
    endedLingerMs: 300,
  });

  // Ilova ishlatmaydigan metodlar yo'q — chaqirilsa test TypeError bilan yiqiladi.
  const services = { api: fakeApi, socket: fakeSocket, push, calls } as unknown as Services;
  return { services, api: fakeApi, socket: fakeSocket, emit, signaling, calls, media };
};
