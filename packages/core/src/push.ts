import { z } from 'zod';

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
export const PushDataSchema = z.object({
  type:      z.literal('message'),
  chatId:    z.uuid(),
  messageId: z.uuid(),
});
export type PushData = z.infer<typeof PushDataSchema>;

/** Matn yashirilganda ko'rsatiladigan sarlavha va matn. */
export const PUSH_HIDDEN_TITLE = 'Suhbat';
export const PUSH_HIDDEN_BODY = 'Yangi xabar';
