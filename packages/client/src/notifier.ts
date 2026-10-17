import { buildNotification, callNotificationBody, PUSH_HIDDEN_TITLE } from '@suhbat/core';
import type { ChatSummary, Message, WsCallIncoming } from '@suhbat/core';
import type { ApiClient } from './api.js';
import type { SocketClient } from './socket.js';

export type NotificationKind = 'message' | 'call';

/** Ko'rsatiladigan bildirishnoma (platforma o'zi chizadi: Android, brauzer, Electron). */
export interface ShownNotification {
  /** Bir xil `tag` — oldingisini almashtiradi (xabar: chatId, qo'ng'iroq: `call:<callId>`). */
  tag:    string;
  kind:   NotificationKind;
  title:  string;
  body:   string;
  /** Bosilganda ochiladigan chat. */
  chatId: string;
}

export interface MessageNotifierOptions {
  api:    Pick<ApiClient, 'me' | 'getChat' | 'getNotificationSettings'>;
  socket: Pick<SocketClient, 'on' | 'onConnectionChange'>;
  /** `true` — foydalanuvchi shu chatni hozir ko'rib turibdi (bildirishnoma kerak emas). */
  isSeen(chatId: string | null): boolean;
  show(n: ShownNotification): void;
  cancel(tag: string): void;
  onError?(e: unknown): void;
  now?(): number;
}

/** Bildirishnoma sozlamasi (preview) shuncha vaqt keshlanadi. */
export const NOTIFICATION_SETTINGS_TTL_MS = 60_000;

export const callNotificationTag = (callId: string) => `call:${callId}`;

/**
 * Socket'dagi `message:new` / `call:invite` dan bildirishnoma yasaydi — FCM'ga bog'liq emas.
 * Sarlavha/matn serverdagi push bilan bir xil (`buildNotification`), "matnni ko'rsatish"
 * sozlamasi hisobga olinadi. `isSeen(null)` — ilova umuman ko'rinib turibdimi (qo'ng'iroq uchun).
 * Qaytgan funksiya tinglashni to'xtatadi.
 */
export const createMessageNotifier = (opts: MessageNotifierOptions): (() => void) => {
  const now = opts.now ?? Date.now;
  const report = opts.onError ?? (() => undefined);
  let myId: string | null = null;
  const chats = new Map<string, ChatSummary>();
  let preview: { value: boolean; at: number } | null = null;

  const getMyId = async () => (myId ??= (await opts.api.me()).id);

  const getChat = async (chatId: string) => {
    const cached = chats.get(chatId);
    if (cached) return cached;
    const chat = await opts.api.getChat(chatId);
    chats.set(chatId, chat);
    return chat;
  };

  const getPreview = async () => {
    if (preview && now() - preview.at < NOTIFICATION_SETTINGS_TTL_MS) return preview.value;
    const value = await opts.api.getNotificationSettings().then((s) => s.preview, () => preview?.value ?? true);
    preview = { value, at: now() };
    return value;
  };

  const onMessage = async (message: Message) => {
    if (message.type === 'system' || opts.isSeen(message.chatId)) return;
    if (message.senderId === (await getMyId())) return;
    const [chat, show] = await Promise.all([getChat(message.chatId), getPreview()]);
    if (opts.isSeen(message.chatId)) return;
    const sender = chat.members.find((m) => m.user.id === message.senderId)?.user.displayName ?? PUSH_HIDDEN_TITLE;
    const { title, body } = buildNotification({ chatType: chat.type, chatTitle: chat.title, senderName: sender }, message, show);
    opts.show({ tag: message.chatId, kind: 'message', title, body, chatId: message.chatId });
  };

  const onCall = async (call: WsCallIncoming) => {
    if (opts.isSeen(null)) return;
    const show = await getPreview();
    opts.show({
      tag:    callNotificationTag(call.callId),
      kind:   'call',
      title:  show ? call.from.displayName : PUSH_HIDDEN_TITLE,
      body:   callNotificationBody(call.media),
      chatId: call.chatId,
    });
  };

  const offs = [
    opts.socket.on('message:new', ({ message }) => void onMessage(message).catch(report)),
    opts.socket.on('call:invite', (call) => void onCall(call).catch(report)),
    opts.socket.on('call:end', ({ callId }) => opts.cancel(callNotificationTag(callId))),
    opts.socket.on('chat:updated', ({ chatId }) => void chats.delete(chatId)),
    opts.socket.on('chat:member', ({ chatId }) => void chats.delete(chatId)),
    // Qayta ulanganda sozlama yangidan o'qiladi.
    opts.socket.onConnectionChange((up) => {
      if (up) preview = null;
    }),
  ];
  return () => offs.forEach((off) => off());
};
