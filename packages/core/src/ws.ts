// WebSocket (Socket.IO) kontrakti — API gateway va `@suhbat/client` uchun bitta.
// Ulanish: `io(url, { auth: { token: <accessToken> } })`. Token yaroqsiz bo'lsa
// server `connect_error` ni `WS_UNAUTHORIZED` xabari bilan qaytaradi.
import { z } from 'zod';
import { MessageContentSchema, MessageSchema } from './schemas.js';
import type { Message } from './schemas.js';

export const WS_UNAUTHORIZED = 'unauthorized';

export const WsEvent = {
  // mijoz → server (ack bilan)
  MessageSend: 'message:send',
  Typing:      'typing',
  MessageRead: 'message:read',
  // server → mijoz
  MessageNew:     'message:new',
  PresenceState:  'presence:state',
  PresenceUpdate: 'presence:update',
} as const;

// --- mijoz → server ---
export const WsSendMessageSchema = z.object({
  chatId:   z.uuid(),
  content:  MessageContentSchema,
  clientId: z.string().min(1).max(64).optional(),
});
export type WsSendMessage = z.infer<typeof WsSendMessageSchema>;

export const WsTypingSchema = z.object({
  chatId:   z.uuid(),
  isTyping: z.boolean(),
});
export type WsTyping = z.infer<typeof WsTypingSchema>;

export const WsMarkReadSchema = z.object({
  chatId:    z.uuid(),
  /** Shu xabargacha (shu xabar ham) o'qildi. */
  messageId: z.uuid(),
});
export type WsMarkRead = z.infer<typeof WsMarkReadSchema>;

// --- server → mijoz ---
export const WsMessageNewSchema = z.object({
  message:  MessageSchema,
  /** Faqat yuboruvchining o'ziga: optimistik xabarni almashtirish uchun. */
  clientId: z.string().optional(),
});
export type WsMessageNew = z.infer<typeof WsMessageNewSchema>;

export interface WsTypingEvent {
  chatId:   string;
  userId:   string;
  isTyping: boolean;
}

export interface WsReadEvent {
  chatId:     string;
  userId:     string;
  lastReadAt: string;
}

export interface WsPresenceState {
  /** Ulanish paytida: umumiy chati bor va hozir onlayn foydalanuvchilar. */
  online: string[];
}

export interface WsPresenceUpdate {
  userId:     string;
  online:     boolean;
  lastSeenAt: string | null;
}

export type WsAck<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ServerToClientEvents {
  'message:new':     (e: WsMessageNew) => void;
  typing:            (e: WsTypingEvent) => void;
  'message:read':    (e: WsReadEvent) => void;
  'presence:state':  (e: WsPresenceState) => void;
  'presence:update': (e: WsPresenceUpdate) => void;
}

export interface ClientToServerEvents {
  'message:send': (p: WsSendMessage, ack: (r: WsAck<Message>) => void) => void;
  typing:         (p: WsTyping) => void;
  'message:read': (p: WsMarkRead, ack: (r: WsAck<{ lastReadAt: string }>) => void) => void;
}
