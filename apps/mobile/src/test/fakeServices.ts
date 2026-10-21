import { createCallManager } from '@suhbat/client';
import type { ApiClient, CallMediaDevices, CallSignaling, PeerConnection, SocketClient } from '@suhbat/client';
import type { MediaStream } from 'react-native-webrtc';
import type { ServerToClientEvents } from '@suhbat/core';
import { disabledBackgroundNative } from '../background/native';
import type { BackgroundController } from '../background/controller';
import type { Services } from '../services/createServices';
import { createConnectionKeeper } from '../services/connectionKeeper';
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
    register:         jest.fn(async () => ({ user: ME, recoveryCodes: [] as string[] })),
    recoverWithCode:  jest.fn(async () => undefined),
    getRecoveryCodesStatus: jest.fn(async () => ({ remaining: 10, generatedAt: '2026-10-01T10:00:00.000Z' })),
    regenerateRecoveryCodes: jest.fn(async () => { throw new Error('regenerateRecoveryCodes mock kerak'); }),
    changePassword:   jest.fn(async () => ME),
    forgotPassword:   jest.fn(async () => ({ message: 'Agar bunday hisob bo\'lsa, havola yuborildi.' })),
    checkUsername:    jest.fn(async (u: string) => ({ username: u, available: true, reason: null })),
    logout:           jest.fn(async () => undefined),
    listChats:        jest.fn(async () => []),
    getChat:          jest.fn(async () => { throw new Error('topilmadi'); }),
    listMessages:     jest.fn(async () => ({ items: [], nextCursor: null })),
    searchUsers:      jest.fn(async () => []),
    searchPublicChannels: jest.fn(async () => []),
    createDirectChat: jest.fn(async () => { throw new Error('createDirectChat mock kerak'); }),
    joinChannel:      jest.fn(async () => { throw new Error('joinChannel mock kerak'); }),
    updateProfile:    jest.fn(async () => ME),
    registerDevice:   jest.fn(async () => undefined),
    getNotificationSettings:    jest.fn(async () => ({ preview: true })),
    updateNotificationSettings: jest.fn(async (input: { preview?: boolean }) => ({ preview: input.preview ?? true })),
    editMessage:      jest.fn(async () => { throw new Error('editMessage mock kerak'); }),
    deleteMessage:    jest.fn(async () => ({ deletedAt: new Date().toISOString() })),
    addMembers:       jest.fn(async () => { throw new Error('addMembers mock kerak'); }),
    removeMember:     jest.fn(async () => undefined),
    setMemberRole:    jest.fn(async () => { throw new Error('setMemberRole mock kerak'); }),
    leaveChat:        jest.fn(async () => undefined),
    deleteChat:       jest.fn(async () => undefined),
    createGroup:      jest.fn(async () => { throw new Error('createGroup mock kerak'); }),
    createChannel:    jest.fn(async () => { throw new Error('createChannel mock kerak'); }),
    updateChat:       jest.fn(async () => { throw new Error('updateChat mock kerak'); }),
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
    editMessage: jest.fn(),
    deleteMessage: jest.fn(async () => ({ deletedAt: new Date().toISOString() })),
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
  const background: BackgroundController = {
    available: false,
    native:    disabledBackgroundNative,
    sync:      jest.fn(async () => undefined),
    isEnabled: jest.fn(async () => false),
    setEnabled: jest.fn(async () => undefined),
    stop:      jest.fn(),
  };
  const connection = createConnectionKeeper(fakeSocket as SocketClient);
  const services = { api: fakeApi, socket: fakeSocket, push, calls, connection, background } as unknown as Services;
  /** Server bilan aloqa uzildi/tiklandi. */
  const setConnected = (value: boolean) => {
    connected = value;
    connectionListeners.forEach((l) => l(value));
  };
  return { services, api: fakeApi, socket: fakeSocket, emit, setConnected, signaling, calls, media, background };
};
