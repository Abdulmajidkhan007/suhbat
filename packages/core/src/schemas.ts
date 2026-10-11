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
  accessToken: z.string(),
  user:        UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
