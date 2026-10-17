import { z } from 'zod';
import { CallMediaSchema } from './calls.js';
import type { CallMedia } from './calls.js';
import type { ChatType, Message } from './schemas.js';

// Push bildirishnomalar (FCM HTTP v1): qurilma tokenlari, sozlamalar va
// bildirishnoma ichidagi `data` kontrakti — API, mobil va veb uchun bitta.

export const DevicePlatformSchema = z.enum(['android', 'ios', 'web']);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

/** FCM registration token (odatda ~160–200 belgi); yuqori chegara zaxira bilan. */
export const DeviceTokenSchema = z.string().trim().min(1).max(4096);

export const RegisterDeviceInputSchema = z.object({
  platform: DevicePlatformSchema,
  token:    DeviceTokenSchema,
});
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInputSchema>;

/** `/auth/logout`: shu qurilmaning push tokeni ham o'chiriladi (ixtiyoriy). */
export const LogoutInputSchema = z.object({
  refreshToken: z.string().min(1).max(512),
  deviceToken:  DeviceTokenSchema.optional(),
});
export type LogoutInput = z.infer<typeof LogoutInputSchema>;

export const NotificationSettingsSchema = z.object({
  /** `true` — bildirishnomada yuboruvchi va matn ko'rinadi; `false` — faqat "Yangi xabar". */
  preview: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

export const UpdateNotificationSettingsInputSchema = NotificationSettingsSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Kamida bitta sozlama kerak' },
);
export type UpdateNotificationSettingsInput = z.infer<typeof UpdateNotificationSettingsInputSchema>;

/** Bildirishnoma `data` qismi (FCM'da hamma qiymat satr). Bosilganda shu chat ochiladi. */
export const PushMessageDataSchema = z.object({
  type:      z.literal('message'),
  chatId:    z.uuid(),
  messageId: z.uuid(),
});
export type PushMessageData = z.infer<typeof PushMessageDataSchema>;

/**
 * Kiruvchi qo'ng'iroq (qabul qiluvchi oflayn). Bosilganda ilova ochilib socket ulanadi —
 * qo'ng'iroq hali jiringlayotgan bo'lsa server `call:invite` ni qayta yuboradi.
 */
export const PushCallDataSchema = z.object({
  type:   z.literal('call'),
  callId: z.uuid(),
  chatId: z.uuid(),
  media:  CallMediaSchema,
});
export type PushCallData = z.infer<typeof PushCallDataSchema>;

export const PushDataSchema = z.discriminatedUnion('type', [PushMessageDataSchema, PushCallDataSchema]);
export type PushData = z.infer<typeof PushDataSchema>;

/** Matn yashirilganda ko'rsatiladigan sarlavha va matn. */
export const PUSH_HIDDEN_TITLE = 'Suhbat';
export const PUSH_HIDDEN_BODY = 'Yangi xabar';

const BODY_MAX = 200;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Xabarning qisqa matni: matn bo'lmasa biriktirma turi. */
export const previewText = (message: Pick<Message, 'type' | 'content'>): string => {
  const text = message.content.trim().replace(/\s+/g, ' ');
  const label = { image: '📷 Rasm', file: '📎 Fayl', voice: '🎤 Ovozli xabar' }[message.type as string];
  if (label) return text ? `${label}: ${truncate(text, BODY_MAX)}` : label;
  return truncate(text, BODY_MAX);
};

/** Kiruvchi qo'ng'iroq bildirishnomasi matni. */
export const callNotificationBody = (media: CallMedia) =>
  media === 'video' ? '🎥 Kiruvchi video qo\'ng\'iroq' : '📞 Kiruvchi qo\'ng\'iroq';

export interface NotificationContext {
  chatType:   ChatType;
  chatTitle:  string | null;
  senderName: string;
}

/**
 * Bildirishnoma sarlavhasi/matni (Telegram'dagidek). Server (FCM) va mobil
 * (FCM'siz fon ulanishi) bir xil matn ko'rsatsin. `preview: false` — faqat "Yangi xabar".
 */
export const buildNotification = (
  ctx: NotificationContext,
  message: Pick<Message, 'type' | 'content'>,
  preview = true,
): { title: string; body: string } => {
  if (!preview) return { title: PUSH_HIDDEN_TITLE, body: PUSH_HIDDEN_BODY };
  const text = previewText(message);
  if (ctx.chatType === 'direct') return { title: ctx.senderName, body: text };
  if (ctx.chatType === 'channel') return { title: ctx.chatTitle ?? PUSH_HIDDEN_TITLE, body: text };
  return { title: ctx.chatTitle ?? PUSH_HIDDEN_TITLE, body: `${ctx.senderName}: ${text}` };
};
