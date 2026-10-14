import {
  AuthResponseSchema,
  ChatMemberSchema,
  ChatSummarySchema,
  IceServersResponseSchema,
  MessagePageSchema,
  MessageSchema,
  NotificationSettingsSchema,
  PublicChannelSchema,
  PublicUserSchema,
  TokenPairSchema,
  UploadUrlResponseSchema,
  UserSchema,
} from '@suhbat/core';
import type {
  ChatMember,
  ChatSummary,
  CreateChannelInput,
  CreateGroupInput,
  IceServersResponse,
  LoginInput,
  Message,
  MessagePage,
  NotificationSettings,
  PublicChannel,
  PublicUser,
  RegisterDeviceInput,
  RegisterInput,
  SendMessageInput,
  TokenPair,
  UpdateChatInput,
  UpdateMemberRoleInput,
  UpdateNotificationSettingsInput,
  UpdateProfileInput,
  UploadUrlInput,
  UploadUrlResponse,
  User,
} from '@suhbat/core';
import { z } from 'zod';
import type { ZodType } from 'zod';
import type { TokenStorage } from './tokens.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  /** Masalan `http://localhost:4000` (oxirida `/` bo'lmasin). */
  baseUrl:  string;
  storage:  TokenStorage;
  fetch?:   typeof fetch;
  /** Refresh token ham yaroqsiz bo'lib, sessiya tugaganda chaqiriladi. */
  onSessionExpired?: () => void;
}

type Query = Record<string, string | number | undefined>;
interface RequestInit_ {
  body?:  unknown;
  query?: Query;
  token?: string;
}

// URLSearchParams React Native'da to'liq emas — qo'lda yig'amiz.
const toQueryString = (query?: Query) => {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

const errorMessage = (body: unknown, status: number): string => {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(', ');
  }
  return `HTTP ${status}`;
};

/** Yuklanadigan fayl tanasi: veb — `File`/`Blob`, RN — `ArrayBuffer`/`Uint8Array`. */
export type UploadBody = Blob | ArrayBuffer | ArrayBufferView;

export type ApiClient = ReturnType<typeof createApiClient>;

export const createApiClient = (opts: ApiClientOptions) => {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const { storage } = opts;
  let refreshing: Promise<TokenPair | null> | null = null;

  async function request<T>(method: string, path: string, schema: ZodType<T> | null, init: RequestInit_ = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.token) headers.Authorization = `Bearer ${init.token}`;

    let res: Response;
    try {
      res = await doFetch(`${opts.baseUrl}${path}${toQueryString(init.query)}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (e) {
      throw new ApiError(0, 'Tarmoq xatosi. Internetni tekshiring.', e);
    }
    const text = await res.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status), body);
    return schema ? schema.parse(body) : (undefined as T);
  }

  /**
   * Bir vaqtda bitta refresh (single-flight). Agar xotiradagi access token
   * so'rovda ishlatilganidan farq qilsa — boshqa tab allaqachon yangilagan,
   * qayta refresh qilinmaydi (aks holda server token qayta ishlatildi deb
   * butun sessiyani yopadi).
   */
  function refreshTokens(usedAccessToken?: string): Promise<TokenPair | null> {
    refreshing ??= (async () => {
      const current = await storage.get();
      if (!current) return null;
      if (usedAccessToken && current.accessToken !== usedAccessToken) return current;
      try {
        const pair = await request('POST', '/auth/refresh', TokenPairSchema, {
          body: { refreshToken: current.refreshToken },
        });
        await storage.set(pair);
        return pair;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 400)) {
          await storage.clear();
          opts.onSessionExpired?.();
          return null;
        }
        throw e;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function authed<T>(method: string, path: string, schema: ZodType<T> | null, init: RequestInit_ = {}): Promise<T> {
    const tokens = await storage.get();
    if (!tokens) throw new ApiError(401, 'Tizimga kirilmagan');
    try {
      return await request(method, path, schema, { ...init, token: tokens.accessToken });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const next = await refreshTokens(tokens.accessToken);
      if (!next) throw e;
      return request(method, path, schema, { ...init, token: next.accessToken });
    }
  }

  async function signIn(path: string, body: unknown): Promise<User> {
    const res = await request('POST', path, AuthResponseSchema, { body });
    await storage.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    return res.user;
  }

  return {
    register: (input: RegisterInput) => signIn('/auth/register', input),
    login:    (input: LoginInput) => signIn('/auth/login', input),

    /**
     * Tokenlar darhol o'chiriladi; serverga xabar berish xatosi e'tiborsiz.
     * `deviceToken` berilsa — shu qurilmaning push tokeni ham serverdan o'chadi.
     */
    async logout(opts: { deviceToken?: string } = {}): Promise<void> {
      const tokens = await storage.get();
      await storage.clear();
      if (!tokens) return;
      const body = { refreshToken: tokens.refreshToken, ...(opts.deviceToken ? { deviceToken: opts.deviceToken } : {}) };
      await request('POST', '/auth/logout', null, { body }).catch(() => undefined);
    },

    me: () => authed('GET', '/auth/me', UserSchema),

    /** Profilni tahrirlash (ism, bio); yangilangan `User` qaytadi. */
    updateProfile: (input: UpdateProfileInput): Promise<User> =>
      authed('PATCH', '/users/me', UserSchema, { body: input }),

    searchUsers: (q: string, limit?: number): Promise<PublicUser[]> =>
      authed('GET', '/users/search', z.array(PublicUserSchema), { query: { q, limit } }),

    listChats: (): Promise<ChatSummary[]> => authed('GET', '/chats', z.array(ChatSummarySchema)),

    getChat: (chatId: string): Promise<ChatSummary> =>
      authed('GET', `/chats/${encodeURIComponent(chatId)}`, ChatSummarySchema),

    createDirectChat: (userId: string): Promise<ChatSummary> =>
      authed('POST', '/chats/direct', ChatSummarySchema, { body: { userId } }),

    listMessages: (chatId: string, params: { before?: string; limit?: number } = {}): Promise<MessagePage> =>
      authed('GET', `/chats/${encodeURIComponent(chatId)}/messages`, MessagePageSchema, { query: params }),

    sendMessage: (chatId: string, input: SendMessageInput): Promise<Message> =>
      authed('POST', `/chats/${encodeURIComponent(chatId)}/messages`, MessageSchema, { body: input }),

    // --- Guruh / kanal ---
    createGroup: (input: CreateGroupInput): Promise<ChatSummary> =>
      authed('POST', '/chats/group', ChatSummarySchema, { body: input }),

    createChannel: (input: CreateChannelInput): Promise<ChatSummary> =>
      authed('POST', '/chats/channel', ChatSummarySchema, { body: input }),

    /** Ochiq kanallar qidiruvi (`q` bo'sh bo'lsa — eng ommabop). */
    searchPublicChannels: (q?: string, limit?: number): Promise<PublicChannel[]> =>
      authed('GET', '/chats/public', z.array(PublicChannelSchema), { query: { q: q || undefined, limit } }),

    updateChat: (chatId: string, input: UpdateChatInput): Promise<ChatSummary> =>
      authed('PATCH', `/chats/${encodeURIComponent(chatId)}`, ChatSummarySchema, { body: input }),

    /** Faqat egasi. */
    deleteChat: (chatId: string): Promise<void> =>
      authed('DELETE', `/chats/${encodeURIComponent(chatId)}`, null),

    /** Ochiq kanalga obuna bo'lish. */
    joinChannel: (chatId: string): Promise<ChatSummary> =>
      authed('POST', `/chats/${encodeURIComponent(chatId)}/join`, ChatSummarySchema),

    leaveChat: (chatId: string): Promise<void> =>
      authed('POST', `/chats/${encodeURIComponent(chatId)}/leave`, null),

    addMembers: (chatId: string, userIds: string[]): Promise<ChatSummary> =>
      authed('POST', `/chats/${encodeURIComponent(chatId)}/members`, ChatSummarySchema, { body: { userIds } }),

    removeMember: (chatId: string, userId: string): Promise<void> =>
      authed('DELETE', `/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`, null),

    setMemberRole: (chatId: string, userId: string, role: UpdateMemberRoleInput['role']): Promise<ChatMember> =>
      authed('PATCH', `/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`, ChatMemberSchema, {
        body: { role },
      }),

    // --- Xabarni tahrirlash / o'chirish ---
    editMessage: (chatId: string, messageId: string, content: string): Promise<Message> =>
      authed('PATCH', `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, MessageSchema, {
        body: { content },
      }),

    deleteMessage: (chatId: string, messageId: string): Promise<{ deletedAt: string }> =>
      authed(
        'DELETE',
        `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
        z.object({ deletedAt: z.string() }),
      ),

    // --- Push bildirishnomalar ---
    /** Qurilma tokenini ro'yxatdan o'tkazadi (idempotent; `onTokenRefresh` da ham chaqiriladi). */
    registerDevice: (input: RegisterDeviceInput): Promise<void> => authed('POST', '/devices', null, { body: input }),

    unregisterDevice: (token: string): Promise<void> =>
      authed('DELETE', `/devices/${encodeURIComponent(token)}`, null),

    getNotificationSettings: (): Promise<NotificationSettings> =>
      authed('GET', '/users/me/notifications', NotificationSettingsSchema),

    updateNotificationSettings: (input: UpdateNotificationSettingsInput): Promise<NotificationSettings> =>
      authed('PATCH', '/users/me/notifications', NotificationSettingsSchema, { body: input }),

    // --- Bloklash ---
    blockUser: (userId: string): Promise<void> =>
      authed('POST', `/users/${encodeURIComponent(userId)}/block`, null),

    unblockUser: (userId: string): Promise<void> =>
      authed('DELETE', `/users/${encodeURIComponent(userId)}/block`, null),

    listBlocked: (): Promise<PublicUser[]> => authed('GET', '/users/blocked', z.array(PublicUserSchema)),

    /** Qo'ng'iroq uchun STUN/TURN (TURN credential vaqtinchalik bo'lishi mumkin — har qo'ng'iroqda so'raladi). */
    getIceServers: (): Promise<IceServersResponse> => authed('GET', '/calls/ice-servers', IceServersResponseSchema),

    // --- Media ---
    createUpload: (input: UploadUrlInput): Promise<UploadUrlResponse> =>
      authed('POST', '/media/upload-url', UploadUrlResponseSchema, { body: input }),

    /**
     * Imzolangan URL olib, faylni to'g'ridan-to'g'ri saqlashga yuklaydi
     * (API orqali oqim o'tmaydi). Qaytgan `attachmentId` — `sendMessage` uchun.
     */
    async uploadAttachment(input: UploadUrlInput, body: UploadBody): Promise<{ attachmentId: string }> {
      const upload = await authed('POST', '/media/upload-url', UploadUrlResponseSchema, { body: input });
      let res: Response;
      try {
        res = await doFetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body: body as BodyInit });
      } catch (e) {
        throw new ApiError(0, 'Faylni yuklab bo\'lmadi. Internetni tekshiring.', e);
      }
      if (!res.ok) throw new ApiError(res.status, `Faylni yuklab bo'lmadi (HTTP ${res.status})`);
      return { attachmentId: upload.attachmentId };
    },

    getAccessToken: async (): Promise<string | null> => (await storage.get())?.accessToken ?? null,

    /** WebSocket uchun: access tokenni yangilaydi; sessiya tugagan bo'lsa null. */
    refreshAccessToken: async (): Promise<string | null> => (await refreshTokens())?.accessToken ?? null,

    hasSession: async (): Promise<boolean> => (await storage.get()) !== null,
  };
};
