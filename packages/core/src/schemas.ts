import { z } from 'zod';

// API kontrakti: vaqtlar JSON'da ISO 8601 satr ko'rinishida.
const isoDate = z.iso.datetime({ offset: true });

export const UserSchema = z.object({
  id:          z.uuid(),
  email:       z.email(),
  displayName: z.string().min(1).max(64),
  photoUrl:    z.url().nullable(),
  createdAt:   isoDate,
});
export type User = z.infer<typeof UserSchema>;

export const ChatTypeSchema = z.enum(['direct', 'group', 'channel']);
export type ChatType = z.infer<typeof ChatTypeSchema>;

export const ChatSchema = z.object({
  id:          z.uuid(),
  type:        ChatTypeSchema,
  title:       z.string().max(128).nullable(),
  description: z.string().max(512).nullable(),
  /** Faqat kanal: ochiq kanalni hamma qidirib, obuna bo'la oladi. */
  isPublic:    z.boolean(),
  createdAt:   isoDate,
  updatedAt:   isoDate,
});
export type Chat = z.infer<typeof ChatSchema>;

export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'voice', 'system']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

// --- Biriktirmalar (media) ---
export const AttachmentKindSchema = z.enum(['image', 'file', 'voice']);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

export const AttachmentSchema = z.object({
  id:         z.uuid(),
  kind:       AttachmentKindSchema,
  name:       z.string().min(1).max(255),
  mime:       z.string().min(1).max(127),
  size:       z.number().int().min(1),
  /** Faqat ovozli xabar uchun, millisekund. */
  durationMs: z.number().int().min(0).nullable(),
  /** Qisqa muddatli imzolangan yuklab olish havolasi (`~1 soat). */
  url:        z.url(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const MessageSchema = z.object({
  id:         z.uuid(),
  chatId:     z.uuid(),
  senderId:   z.uuid(),
  type:       MessageTypeSchema,
  /** Matn yoki biriktirma izohi (biriktirma bilan bo'sh bo'lishi mumkin). */
  content:    z.string().max(4096),
  attachment: AttachmentSchema.nullable(),
  createdAt:  isoDate,
  editedAt:   isoDate.nullable(),
});
export type Message = z.infer<typeof MessageSchema>;

// --- Auth ---
export const RegisterInputSchema = z.object({
  email:       z.email().transform((e) => e.toLowerCase()),
  password:    z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(64),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email:    z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthResponseSchema = z.object({
  accessToken:  z.string(),
  /** Opaque, bir martalik: `/auth/refresh` da yangisiga almashtiriladi (rotatsiya). */
  refreshToken: z.string(),
  user:         UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

export const TokenPairSchema = z.object({
  accessToken:  z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

// --- Foydalanuvchilar ---
export const UserSearchQuerySchema = z.object({
  q:     z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;

// --- Chatlar ---
export const ChatRoleSchema = z.enum(['owner', 'admin', 'member']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMemberSchema = z.object({
  user:       UserSchema,
  role:       ChatRoleSchema,
  /** Shu vaqtgacha (shu vaqt ham) yuborilgan xabarlarni o'qigan. */
  lastReadAt: isoDate.nullable(),
  lastSeenAt: isoDate.nullable(),
});
export type ChatMember = z.infer<typeof ChatMemberSchema>;

/** Chat ro'yxati va chat sahifasi uchun: a'zolar, oxirgi xabar, o'qilmaganlar. */
export const ChatSummarySchema = ChatSchema.extend({
  /**
   * Direct/guruhda — hamma a'zo. Kanalda katta bo'lishi mumkinligi uchun faqat
   * owner/adminlar va so'rayotgan foydalanuvchi; to'liq son — `memberCount`.
   */
  members:     z.array(ChatMemberSchema),
  memberCount: z.number().int().min(0),
  lastMessage: MessageSchema.nullable(),
  unreadCount: z.number().int().min(0),
});
export type ChatSummary = z.infer<typeof ChatSummarySchema>;

export const CreateDirectChatInputSchema = z.object({
  userId: z.uuid(),
});
export type CreateDirectChatInput = z.infer<typeof CreateDirectChatInputSchema>;

export const MAX_GROUP_MEMBERS = 200;

const ChatTitleSchema = z.string().trim().min(1).max(128);
const ChatDescriptionSchema = z.string().trim().max(512);

export const CreateGroupInputSchema = z.object({
  title:       ChatTitleSchema,
  description: ChatDescriptionSchema.optional(),
  /** Yaratuvchidan tashqari a'zolar (bo'sh bo'lishi mumkin). */
  memberIds:   z.array(z.uuid()).max(MAX_GROUP_MEMBERS - 1),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

export const CreateChannelInputSchema = z.object({
  title:       ChatTitleSchema,
  description: ChatDescriptionSchema.optional(),
  isPublic:    z.boolean(),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

export const UpdateChatInputSchema = z
  .object({
    title:       ChatTitleSchema.optional(),
    /** Bo'sh satr — tavsifni o'chiradi. */
    description: ChatDescriptionSchema.optional(),
    isPublic:    z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Kamida bitta maydon kerak' });
export type UpdateChatInput = z.infer<typeof UpdateChatInputSchema>;

export const AddMembersInputSchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(100),
});
export type AddMembersInput = z.infer<typeof AddMembersInputSchema>;

/** `owner` tayinlanmaydi — egalik boshqa kishiga o'tkazilmaydi. */
export const UpdateMemberRoleInputSchema = z.object({
  role: z.enum(['admin', 'member']),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInputSchema>;

/** Ochiq kanallar qidiruvi natijasi. */
export const PublicChannelSchema = z.object({
  id:          z.uuid(),
  title:       z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int().min(0),
  isMember:    z.boolean(),
});
export type PublicChannel = z.infer<typeof PublicChannelSchema>;

export const PublicChannelsQuerySchema = z.object({
  q:     z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PublicChannelsQuery = z.infer<typeof PublicChannelsQuerySchema>;

// --- Media cheklovlari (server tekshiradi, mijoz oldindan ko'rsatadi) ---
export interface AttachmentRule {
  maxBytes: number;
  mimes:    readonly string[];
}

const MB = 1024 * 1024;
export const MAX_VOICE_DURATION_MS = 5 * 60 * 1000;

export const ATTACHMENT_RULES: Record<AttachmentKind, AttachmentRule> = {
  image: {
    maxBytes: 10 * MB,
    mimes:    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  voice: {
    maxBytes: 10 * MB,
    mimes:    ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac'],
  },
  // SVG/HTML/JS/bajariladigan fayllar ataylab yo'q (XSS va zararli fayl xavfi).
  file: {
    maxBytes: 25 * MB,
    mimes:    [
      'application/pdf',
      'application/zip',
      'application/json',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/wav',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ],
  },
};

/** `audio/webm;codecs=opus` → `audio/webm`. */
export const normalizeMime = (mime: string): string => (mime.split(';')[0] ?? '').trim().toLowerCase();

export const isAllowedMime = (kind: AttachmentKind, mime: string): boolean =>
  ATTACHMENT_RULES[kind].mimes.includes(normalizeMime(mime));

/** Eng mos tur: rasm → image, ruxsat etilgan audio emas → file. */
export const kindOfFile = (mime: string): AttachmentKind =>
  isAllowedMime('image', mime) ? 'image' : 'file';

export const UploadUrlInputSchema = z
  .object({
    chatId:     z.uuid(),
    kind:       AttachmentKindSchema,
    name:       z.string().trim().min(1).max(255),
    mime:       z.string().min(1).max(127).transform(normalizeMime),
    size:       z.number().int().min(1),
    durationMs: z.number().int().min(0).max(MAX_VOICE_DURATION_MS).optional(),
  })
  .superRefine((v, ctx) => {
    const rule = ATTACHMENT_RULES[v.kind];
    if (!rule.mimes.includes(v.mime)) {
      ctx.addIssue({ code: 'custom', path: ['mime'], message: `Bu fayl turi ruxsat etilmagan: ${v.mime}` });
    }
    if (v.size > rule.maxBytes) {
      ctx.addIssue({ code: 'custom', path: ['size'], message: `Fayl hajmi ${rule.maxBytes / MB} MB dan oshmasligi kerak` });
    }
    if (v.kind === 'voice' && v.durationMs === undefined) {
      ctx.addIssue({ code: 'custom', path: ['durationMs'], message: 'Ovozli xabar uchun davomiylik kerak' });
    }
  });
export type UploadUrlInput = z.infer<typeof UploadUrlInputSchema>;

export const UploadUrlResponseSchema = z.object({
  attachmentId: z.uuid(),
  /** Imzolangan `PUT` havola: tanasi — fayl, sarlavhalar — `headers`. */
  uploadUrl:    z.url(),
  headers:      z.record(z.string(), z.string()),
  expiresAt:    isoDate,
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

// --- Xabarlar ---
/** Biriktirmasiz xabarda bo'sh bo'lmasligi `SendMessageInputSchema` da tekshiriladi. */
export const MessageContentSchema = z.string().trim().max(4096);

export const MessageBodySchema = z.object({
  content:      MessageContentSchema,
  /** `POST /media/upload-url` + yuklashdan keyin; matn o'rniga/bilan yuboriladi. */
  attachmentId: z.uuid().optional(),
  /** Mijoz tomonidagi vaqtinchalik id (optimistik xabarni almashtirish uchun). */
  clientId:     z.string().min(1).max(64).optional(),
});

export const hasContentOrAttachment = (v: { content: string; attachmentId?: string | undefined }) =>
  v.content.length > 0 || v.attachmentId !== undefined;

export const SendMessageInputSchema = MessageBodySchema.refine(hasContentOrAttachment, {
  message: 'Matn yoki biriktirma kerak',
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

/** Faqat matn tahrirlanadi, bo'sh bo'lmasligi shart. */
export const EditMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(4096),
});
export type EditMessageInput = z.infer<typeof EditMessageInputSchema>;

export const MessagesQuerySchema = z.object({
  /** Oldingi sahifadagi `nextCursor` — undan eskiroq xabarlar qaytadi. */
  before: z.string().min(1).max(256).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQuery = z.infer<typeof MessagesQuerySchema>;

export const MessagePageSchema = z.object({
  /** Xronologik tartibda (eskisidan yangisiga). */
  items:      z.array(MessageSchema),
  /** Eskiroq xabarlar bo'lsa — keyingi so'rov uchun `before`; aks holda null. */
  nextCursor: z.string().nullable(),
});
export type MessagePage = z.infer<typeof MessagePageSchema>;

/** Xabar holati: `sent` — serverda saqlangan, `read` — qabul qiluvchi o'qigan. */
export const MessageStatusSchema = z.enum(['sent', 'read']);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;
