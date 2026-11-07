import { z } from 'zod';
import { ADMIN_PAGE_SIZE_DEFAULT, ADMIN_PAGE_SIZE_MAX } from './admin.js';

// Faoliyat jurnali (REJA 6b): FAQAT metadata. Xabar matni va media mazmuni jurnalga HECH QACHON tushmaydi.
const isoDate = z.iso.datetime({ offset: true });

export const ActivityTypeSchema = z.enum([
  'register', 'login', 'login_failed', 'logout', 'password_change',
  'chat_create', 'group_join', 'group_leave', 'channel_create',
  'message_send', 'media_upload', 'message_delete',
  'call_start', 'call_end', 'report',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/** `private` — 1:1 chat. Guruh doim yopiq; kanal ochiq yoki yopiq bo'lishi mumkin. */
export const ActivityChatKindSchema = z.enum(['private', 'group', 'channel']);
export type ActivityChatKind = z.infer<typeof ActivityChatKindSchema>;

export const ActivityMediaKindSchema = z.enum(['image', 'video', 'voice', 'file']);
export type ActivityMediaKind = z.infer<typeof ActivityMediaKindSchema>;

/** Jurnalga yoziladigan `meta`: faqat raqam/enum (oq ro'yxat) — matn uchun joy yo'q. */
export const ActivityMetaSchema = z.object({
  length:        z.number().int().min(0).optional(),
  hasAttachment: z.boolean().optional(),
  reason:        z.string().max(32).optional(),
  durationMs:    z.number().int().min(0).optional(),
  callMedia:     z.enum(['audio', 'video']).optional(),
});
export type ActivityMeta = z.infer<typeof ActivityMetaSchema>;

const optionalDay = z.preprocess((v) => (v === '' ? undefined : v), z.iso.datetime({ offset: true }).optional());

export const AdminActivityQuerySchema = z.object({
  userId:   z.uuid().optional(),
  type:     ActivityTypeSchema.optional(),
  chatKind: ActivityChatKindSchema.optional(),
  /** Oraliq: `from` dan (shu vaqt ham), `to` gacha (shu vaqt kirmaydi). */
  from:     optionalDay,
  to:       optionalDay,
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
});
export type AdminActivityQuery = z.infer<typeof AdminActivityQuerySchema>;

export const AdminActivityMediaSchema = z.object({
  kind:         ActivityMediaKindSchema,
  mime:         z.string(),
  size:         z.number().int().min(0),
  name:         z.string(),
  attachmentId: z.uuid().nullable(),
  /** Mazmunni ko'rish mumkinmi: faqat ochiq kanal media'si yoki shikoyat qilingan xabar. */
  previewable:  z.boolean(),
});
export type AdminActivityMedia = z.infer<typeof AdminActivityMediaSchema>;

export const AdminActivityEntrySchema = z.object({
  id:         z.uuid(),
  type:       z.string(),
  userId:     z.uuid().nullable(),
  /** Ism va @username/email; foydalanuvchi o'chgan yoki noma'lum bo'lsa `null`. */
  userLabel:  z.string().nullable(),
  chatId:     z.uuid().nullable(),
  chatKind:   ActivityChatKindSchema.nullable(),
  chatPublic: z.boolean().nullable(),
  ip:         z.string().nullable(),
  device:     z.string().nullable(),
  meta:       ActivityMetaSchema.nullable(),
  media:      AdminActivityMediaSchema.nullable(),
  createdAt:  isoDate,
});
export type AdminActivityEntry = z.infer<typeof AdminActivityEntrySchema>;

export const AdminActivityListSchema = z.object({
  items:    z.array(AdminActivityEntrySchema),
  total:    z.number().int().min(0),
  page:     z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminActivityList = z.infer<typeof AdminActivityListSchema>;

export const AdminMediaQuerySchema = z.object({
  userId:   z.uuid().optional(),
  kind:     ActivityMediaKindSchema.optional(),
  chatKind: ActivityChatKindSchema.optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
});
export type AdminMediaQuery = z.infer<typeof AdminMediaQuerySchema>;

export const AdminMediaListSchema = AdminActivityListSchema.extend({
  /** Butun saqlangan media bo'yicha (jurnal muddati bilan cheklanmagan). */
  stats: z.object({
    totalCount: z.number().int().min(0),
    totalBytes: z.number().int().min(0),
    byKind:     z.array(z.object({ kind: ActivityMediaKindSchema, count: z.number().int().min(0), bytes: z.number().int().min(0) })),
  }),
});
export type AdminMediaList = z.infer<typeof AdminMediaListSchema>;

export const AdminMediaPreviewSchema = z.object({ url: z.string(), name: z.string(), mime: z.string(), kind: ActivityMediaKindSchema });
export type AdminMediaPreview = z.infer<typeof AdminMediaPreviewSchema>;

export const AdminOverviewSchema = z.object({
  usersTotal:    z.number().int().min(0),
  /** Bugun (server UTC kuni) kamida bitta amal qilgan foydalanuvchilar. */
  activeToday:   z.number().int().min(0),
  newUsersToday: z.number().int().min(0),
  mediaBytes24h: z.number().int().min(0),
  mediaBytesTotal: z.number().int().min(0),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

// --- Shikoyatlar ---
export const REPORT_REASON_MAX = 200;
export const ReportMessageInputSchema = z.object({
  reason: z.string().trim().max(REPORT_REASON_MAX).optional(),
});
export type ReportMessageInput = z.infer<typeof ReportMessageInputSchema>;

export const AdminReportSchema = z.object({
  id:            z.uuid(),
  createdAt:     isoDate,
  reason:        z.string().nullable(),
  reporterLabel: z.string().nullable(),
  chatKind:      ActivityChatKindSchema,
  /** Faqat shikoyat qilingan xabar mazmuni adminga ko'rinadi. */
  message: z.object({
    id:          z.uuid(),
    chatId:      z.uuid(),
    senderId:    z.uuid(),
    senderLabel: z.string().nullable(),
    type:        z.string(),
    content:     z.string(),
    createdAt:   isoDate,
    deleted:     z.boolean(),
    attachmentId: z.uuid().nullable(),
  }),
});
export type AdminReport = z.infer<typeof AdminReportSchema>;

export const AdminReportListSchema = z.object({
  items: z.array(AdminReportSchema), total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.number().int().min(1),
});
export type AdminReportList = z.infer<typeof AdminReportListSchema>;

// --- Maxfiylik sahifasi (veb va mobil bir xil matn) ---
export const PrivacyInfoSchema = z.object({ retentionDays: z.number().int().min(1) });
export type PrivacyInfo = z.infer<typeof PrivacyInfoSchema>;

/** Server javobi kelmaganda ko'rsatiladigan standart (server standarti bilan bir xil). */
export const DEFAULT_PRIVACY_RETENTION_DAYS = 90;

export interface PrivacySection {
  title: string;
  items: string[];
}

/** Rost bayon: nima yoziladi, nima yozilmaydi, qancha saqlanadi. `{days}` serverdagi muddat bilan almashtiriladi. */
export const privacySections = (retentionDays: number): PrivacySection[] => [
  {
    title: 'Nima yoziladi',
    items: [
      'Hisob amallari: ro\'yxatdan o\'tish, kirish, muvaffaqiyatsiz kirish urinishi, chiqish, parol o\'zgartirish.',
      'Chat amallari: chat, guruh va kanal yaratish, guruh/kanalga qo\'shilish va chiqish, xabar yuborish va o\'chirish.',
      'Xabar yuborilganda faqat chat turi (shaxsiy, guruh, kanal), xabar uzunligi va biriktirma bor-yo\'qligi yoziladi.',
      'Fayl yuklanganda: turi (rasm, video, ovoz, fayl), MIME turi, hajmi va fayl nomi.',
      'Qo\'ng\'iroq boshlanishi va tugashi (davomiyligi bilan).',
      'Har amal bilan birga vaqt, IP-manzil va qurilma (brauzer/ilova) qisqa nomi saqlanadi.',
    ],
  },
  {
    title: 'Nima o\'qilmaydi',
    items: [
      'Shaxsiy (1:1) chat va yopiq guruh xabarlarining MATNI administratorga ko\'rinmaydi va jurnalga yozilmaydi.',
      'Shaxsiy chat va yopiq guruhga yuborilgan rasm, video, ovoz va fayllar MAZMUNI administratorga ko\'rinmaydi — faqat metadata.',
      'Qo\'ng\'iroq tovushi va videosi serverdan o\'tmaydi va yozilmaydi.',
    ],
  },
  {
    title: 'Istisnolar',
    items: [
      'Ochiq kanalga yuklangan media administratorga ko\'rinishi mumkin — ochiq kanalni hamma ko\'ra oladi.',
      'Biror foydalanuvchi xabarga shikoyat (report) qilsa, shu xabarning mazmuni (va biriktirmasi) administratorga ko\'rinadi.',
    ],
  },
  {
    title: 'Qancha saqlanadi',
    items: [
      `Faoliyat jurnali ${retentionDays} kun saqlanadi, undan eskilari har kuni avtomatik o'chiriladi.`,
      'Administrator amallari (bloklash, parol berish va h.k.) alohida jurnalda yoziladi.',
      'Chatlardagi xabarlar va fayllar hisob yoki chat o\'chirilguncha saqlanadi.',
    ],
  },
];
