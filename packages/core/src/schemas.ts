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
  id:        z.uuid(),
  type:      ChatTypeSchema,
  title:     z.string().max(128).nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Chat = z.infer<typeof ChatSchema>;

export const MessageTypeSchema = z.enum(['text', 'image', 'file', 'voice', 'system']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  id:        z.uuid(),
  chatId:    z.uuid(),
  senderId:  z.uuid(),
  type:      MessageTypeSchema,
  content:   z.string().max(4096),
  createdAt: isoDate,
  editedAt:  isoDate.nullable(),
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
  members:     z.array(ChatMemberSchema),
  lastMessage: MessageSchema.nullable(),
  unreadCount: z.number().int().min(0),
});
export type ChatSummary = z.infer<typeof ChatSummarySchema>;

export const CreateDirectChatInputSchema = z.object({
  userId: z.uuid(),
});
export type CreateDirectChatInput = z.infer<typeof CreateDirectChatInputSchema>;

// --- Xabarlar ---
export const MessageContentSchema = z.string().trim().min(1).max(4096);

export const SendMessageInputSchema = z.object({
  content:  MessageContentSchema,
  /** Mijoz tomonidagi vaqtinchalik id (optimistik xabarni almashtirish uchun). */
  clientId: z.string().min(1).max(64).optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

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
