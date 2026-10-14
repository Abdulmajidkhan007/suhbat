import { WS_UNAUTHORIZED } from '@suhbat/core';
import type {
  CallIceCandidate,
  CallSdp,
  ClientToServerEvents,
  Message,
  ServerToClientEvents,
  WsAck,
  WsCallInvite,
  WsCallRef,
  WsSendMessage,
} from '@suhbat/core';
import { io } from 'socket.io-client';
import type { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

export interface SocketClientOptions {
  url: string;
  getAccessToken:     () => Promise<string | null>;
  /** `connect_error: unauthorized` bo'lganda bir marta chaqiriladi. */
  refreshAccessToken: () => Promise<string | null>;
  /** Refresh ham yordam bermasa. */
  onUnauthorized?:    () => void;
  ackTimeoutMs?:      number;
  socketOptions?:     Partial<ManagerOptions & SocketOptions>;
  /** Testlar uchun almashtirish mumkin. */
  io?: typeof io;
}

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type SocketClient = ReturnType<typeof createSocketClient>;

const unwrap = <T>(r: WsAck<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

export const createSocketClient = (opts: SocketClientOptions) => {
  const ackTimeout = opts.ackTimeoutMs ?? 10_000;
  const socket: TypedSocket = (opts.io ?? io)(opts.url, {
    autoConnect: false,
    transports:  ['websocket'],
    ...opts.socketOptions,
    // Har (qayta) ulanishda eng so'nggi token olinadi.
    auth: (cb) => {
      opts.getAccessToken().then(
        (token) => cb({ token: token ?? '' }),
        () => cb({ token: '' }),
      );
    },
  });

  let refreshTried = false;
  socket.on('connect', () => {
    refreshTried = false;
  });
  // Server middleware'i rad etsa socket.io o'zi qayta ulanmaydi —
  // tokenni yangilab qo'lda ulanamiz (faqat bir marta).
  socket.on('connect_error', (err) => {
    if (err.message !== WS_UNAUTHORIZED) return;
    if (refreshTried) {
      opts.onUnauthorized?.();
      return;
    }
    refreshTried = true;
    opts.refreshAccessToken().then(
      (token) => (token ? socket.connect() : opts.onUnauthorized?.()),
      () => opts.onUnauthorized?.(),
    );
  });

  // Server access token tugaganda ulanishni o'zi uzadi ("io server disconnect"):
  // socket.io bunda qayta ulanmaydi — tokenni yangilab o'zimiz ulanamiz.
  socket.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    opts.refreshAccessToken().then(
      (token) => (token ? socket.connect() : opts.onUnauthorized?.()),
      () => opts.onUnauthorized?.(),
    );
  });

  return {
    socket,
    connect:      () => void socket.connect(),
    disconnect:   () => void socket.disconnect(),
    isConnected:  () => socket.connected,

    on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): () => void {
      // socket.io'ning umumiy tiplari bu yerda torayishni tushunmaydi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = socket as any;
      s.on(event, listener);
      return () => s.off(event, listener);
    },

    onConnectionChange(listener: (connected: boolean) => void): () => void {
      const up = () => listener(true);
      const down = () => listener(false);
      socket.on('connect', up);
      socket.on('disconnect', down);
      return () => {
        socket.off('connect', up);
        socket.off('disconnect', down);
      };
    },

    async sendMessage(payload: WsSendMessage): Promise<Message> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('message:send', payload));
    },

    async editMessage(chatId: string, messageId: string, content: string): Promise<Message> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('message:edit', { chatId, messageId, content }));
    },

    async deleteMessage(chatId: string, messageId: string): Promise<{ deletedAt: string }> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('message:delete', { chatId, messageId }));
    },

    setTyping(chatId: string, isTyping: boolean): void {
      if (socket.connected) socket.emit('typing', { chatId, isTyping });
    },

    async markRead(chatId: string, messageId: string): Promise<{ lastReadAt: string }> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('message:read', { chatId, messageId }));
    },

    // --- Qo'ng'iroq signali (`@suhbat/core` calls.ts) ---
    async inviteCall(payload: WsCallInvite): Promise<WsCallRef> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('call:invite', payload));
    },
    callRinging(callId: string): void {
      socket.emit('call:ringing', { callId });
    },
    async acceptCall(callId: string): Promise<WsCallRef> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('call:accept', { callId }));
    },
    async rejectCall(callId: string): Promise<WsCallRef> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('call:reject', { callId }));
    },
    async cancelCall(callId: string): Promise<WsCallRef> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('call:cancel', { callId }));
    },
    async endCall(callId: string): Promise<WsCallRef> {
      return unwrap(await socket.timeout(ackTimeout).emitWithAck('call:end', { callId }));
    },
    sendCallOffer(callId: string, description: CallSdp): void {
      socket.emit('call:offer', { callId, description });
    },
    sendCallAnswer(callId: string, description: CallSdp): void {
      socket.emit('call:answer', { callId, description });
    },
    sendCallIce(callId: string, candidate: CallIceCandidate | null): void {
      socket.emit('call:ice', { callId, candidate });
    },
  };
};
