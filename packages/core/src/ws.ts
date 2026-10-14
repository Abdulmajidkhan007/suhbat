// WebSocket (Socket.IO) kontrakti — API gateway va `@suhbat/client` uchun bitta.
// Ulanish: `io(url, { auth: { token: <accessToken> } })`. Token yaroqsiz bo'lsa
// server `connect_error` ni `WS_UNAUTHORIZED` xabari bilan qaytaradi.
import { z } from 'zod';
import {
  ChatMemberSchema,
  EditMessageInputSchema,
  MessageBodySchema,
  MessageSchema,
  hasContentOrAttachment,
} from './schemas.js';
import type { ChatMember, Message } from './schemas.js';
import type {
  WsCallEnded,
  WsCallIce,
  WsCallIncoming,
  WsCallInvite,
  WsCallRef,
  WsCallSdp,
} from './calls.js';

export const WS_UNAUTHORIZED = 'unauthorized';

export const WsEvent = {
  // mijoz → server (ack bilan)
  MessageSend: 'message:send',
  Typing:      'typing',
  MessageRead: 'message:read',
  MessageEdit:   'message:edit',
  MessageDelete: 'message:delete',
  // server → mijoz
  MessageNew:     'message:new',
  MessageUpdated: 'message:updated',
  MessageDeleted: 'message:deleted',
  ChatUpdated:    'chat:updated',
  ChatMember:     'chat:member',
  ChatDeleted:    'chat:deleted',
  PresenceState:  'presence:state',
  PresenceUpdate: 'presence:update',
  // qo'ng'iroqlar (ikki yo'nalishda; batafsil — `calls.ts`)
  CallInvite:  'call:invite',
  CallRinging: 'call:ringing',
  CallAccept:  'call:accept',
  CallReject:  'call:reject',
  CallCancel:  'call:cancel',
  CallEnd:     'call:end',
  CallOffer:   'call:offer',
  CallAnswer:  'call:answer',
  CallIce:     'call:ice',
  CallBusy:    'call:busy',
} as const;

// --- mijoz → server ---
export const WsSendMessageSchema = MessageBodySchema.extend({
  chatId: z.uuid(),
}).refine(hasContentOrAttachment, { message: 'Matn yoki biriktirma kerak' });
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

export const WsEditMessageSchema = EditMessageInputSchema.extend({
  chatId:    z.uuid(),
  messageId: z.uuid(),
});
export type WsEditMessage = z.infer<typeof WsEditMessageSchema>;

export const WsDeleteMessageSchema = z.object({
  chatId:    z.uuid(),
  messageId: z.uuid(),
});
export type WsDeleteMessage = z.infer<typeof WsDeleteMessageSchema>;

// --- server → mijoz ---
export const WsMessageNewSchema = z.object({
  message:  MessageSchema,
  /** Faqat yuboruvchining o'ziga: optimistik xabarni almashtirish uchun. */
  clientId: z.string().optional(),
});
export type WsMessageNew = z.infer<typeof WsMessageNewSchema>;

export const WsMessageUpdatedSchema = z.object({ message: MessageSchema });
export type WsMessageUpdated = z.infer<typeof WsMessageUpdatedSchema>;

export interface WsMessageDeleted {
  chatId:    string;
  messageId: string;
  deletedAt: string;
}

/** Guruh/kanal sozlamalari o'zgardi (nom, tavsif, ochiqlik). */
export interface WsChatUpdated {
  chatId:      string;
  title:       string | null;
  description: string | null;
  isPublic:    boolean;
  updatedAt:   string;
}

export type WsChatMemberAction = 'added' | 'removed' | 'role';

/**
 * A'zolik o'zgardi. `removed` da `member` null. Yangi a'zo (`userId` o'zi) bu
 * voqeani olganda chatni `getChat` bilan yuklaydi; chiqarilgan a'zo — chatni olib tashlaydi.
 */
export interface WsChatMember {
  chatId:      string;
  userId:      string;
  action:      WsChatMemberAction;
  member:      ChatMember | null;
  memberCount: number;
}
export const WsChatMemberSchema = z.object({
  chatId:      z.uuid(),
  userId:      z.uuid(),
  action:      z.enum(['added', 'removed', 'role']),
  member:      ChatMemberSchema.nullable(),
  memberCount: z.number().int().min(0),
});

export interface WsChatDeleted {
  chatId: string;
}

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
  'message:updated': (e: WsMessageUpdated) => void;
  'message:deleted': (e: WsMessageDeleted) => void;
  'chat:updated':    (e: WsChatUpdated) => void;
  'chat:member':     (e: WsChatMember) => void;
  'chat:deleted':    (e: WsChatDeleted) => void;
  typing:            (e: WsTypingEvent) => void;
  'message:read':    (e: WsReadEvent) => void;
  'presence:state':  (e: WsPresenceState) => void;
  'presence:update': (e: WsPresenceUpdate) => void;
  /** Kiruvchi qo'ng'iroq (ulanganda hali jiringlayotgan bo'lsa qayta yuboriladi). */
  'call:invite':     (e: WsCallIncoming) => void;
  /** Chaqiruvchiga: qabul qiluvchining qurilmasi jiringlayapti. */
  'call:ringing':    (e: WsCallRef) => void;
  /** Chaqiruvchiga: qabul qilindi — endi `call:offer` yuboradi. */
  'call:accept':     (e: WsCallRef) => void;
  'call:end':        (e: WsCallEnded) => void;
  /** Chaqiruvchiga: qabul qiluvchi boshqa qo'ng'iroqda. */
  'call:busy':       (e: WsCallRef) => void;
  'call:offer':      (e: WsCallSdp) => void;
  'call:answer':     (e: WsCallSdp) => void;
  'call:ice':        (e: WsCallIce) => void;
}

export interface ClientToServerEvents {
  'message:send': (p: WsSendMessage, ack: (r: WsAck<Message>) => void) => void;
  typing:         (p: WsTyping) => void;
  'message:read': (p: WsMarkRead, ack: (r: WsAck<{ lastReadAt: string }>) => void) => void;
  'message:edit': (p: WsEditMessage, ack: (r: WsAck<Message>) => void) => void;
  'message:delete': (p: WsDeleteMessage, ack: (r: WsAck<{ deletedAt: string }>) => void) => void;
  'call:invite':    (p: WsCallInvite, ack: (r: WsAck<WsCallRef>) => void) => void;
  'call:ringing':   (p: WsCallRef) => void;
  'call:accept':    (p: WsCallRef, ack: (r: WsAck<WsCallRef>) => void) => void;
  'call:reject':    (p: WsCallRef, ack: (r: WsAck<WsCallRef>) => void) => void;
  'call:cancel':    (p: WsCallRef, ack: (r: WsAck<WsCallRef>) => void) => void;
  'call:end':       (p: WsCallRef, ack: (r: WsAck<WsCallRef>) => void) => void;
  'call:offer':     (p: WsCallSdp) => void;
  'call:answer':    (p: WsCallSdp) => void;
  'call:ice':       (p: WsCallIce) => void;
}
