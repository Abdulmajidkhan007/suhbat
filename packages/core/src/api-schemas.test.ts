import { describe, expect, it } from 'vitest';
import {
  CreateDirectChatInputSchema,
  CreateGroupInputSchema,
  EditMessageInputSchema,
  MAX_GROUP_MEMBERS,
  MAX_VOICE_DURATION_MS,
  MessagesQuerySchema,
  SendMessageInputSchema,
  UpdateChatInputSchema,
  UpdateMemberRoleInputSchema,
  UploadUrlInputSchema,
  UserSearchQuerySchema,
} from './schemas.js';
import { WsSendMessageSchema, WsTypingSchema } from './ws.js';

const uuid = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';

describe('REST sxemalar', () => {
  it('UserSearchQuery: q ni kesadi, limit satrdan raqamga', () => {
    expect(UserSearchQuerySchema.parse({ q: ' ali ', limit: '5' })).toEqual({ q: 'ali', limit: 5 });
    expect(UserSearchQuerySchema.parse({ q: 'ali' }).limit).toBe(20);
    expect(UserSearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(UserSearchQuerySchema.safeParse({ q: 'a', limit: '500' }).success).toBe(false);
  });

  it('MessagesQuery: limit standart 50, 100 dan oshmaydi', () => {
    expect(MessagesQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(MessagesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('SendMessageInput: bo\'sh yoki juda uzun matn rad etiladi', () => {
    expect(SendMessageInputSchema.parse({ content: ' salom ' }).content).toBe('salom');
    expect(SendMessageInputSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(SendMessageInputSchema.safeParse({ content: 'x'.repeat(4097) }).success).toBe(false);
  });

  it('CreateDirectChatInput: uuid talab qiladi', () => {
    expect(CreateDirectChatInputSchema.safeParse({ userId: uuid }).success).toBe(true);
    expect(CreateDirectChatInputSchema.safeParse({ userId: 'x' }).success).toBe(false);
  });
});

describe('WebSocket sxemalar', () => {
  it('message:send va typing payloadlari', () => {
    expect(WsSendMessageSchema.safeParse({ chatId: uuid, content: 'hi', clientId: 'c1' }).success).toBe(true);
    expect(WsSendMessageSchema.safeParse({ chatId: 'x', content: 'hi' }).success).toBe(false);
    expect(WsTypingSchema.safeParse({ chatId: uuid, isTyping: 'ha' }).success).toBe(false);
  });
});

describe('Guruh/kanal sxemalari', () => {
  it('CreateGroupInput: nom majburiy, a\'zolar uuid', () => {
    expect(CreateGroupInputSchema.parse({ title: '  Do\'stlar ', memberIds: [uuid] }).title).toBe('Do\'stlar');
    expect(CreateGroupInputSchema.safeParse({ title: ' ', memberIds: [] }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: 'x', memberIds: ['x'] }).success).toBe(false);
    expect(CreateGroupInputSchema.safeParse({ title: 'x', memberIds: Array(MAX_GROUP_MEMBERS).fill(uuid) }).success).toBe(false);
  });

  it('UpdateChatInput: kamida bitta maydon', () => {
    expect(UpdateChatInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateChatInputSchema.safeParse({ isPublic: false }).success).toBe(true);
  });

  it('UpdateMemberRole: owner tayinlab bo\'lmaydi', () => {
    expect(UpdateMemberRoleInputSchema.safeParse({ role: 'admin' }).success).toBe(true);
    expect(UpdateMemberRoleInputSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('Biriktirma sxemalari', () => {
  const base = { chatId: uuid, name: 'a.png', mime: 'image/png', size: 1000 };

  it('UploadUrlInput: MIME normallashadi va ruxsat ro\'yxati tekshiriladi', () => {
    const ok = UploadUrlInputSchema.parse({ ...base, kind: 'image', mime: 'IMAGE/PNG; charset=x' });
    expect(ok.mime).toBe('image/png');
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'image', mime: 'image/svg+xml' }).success).toBe(false);
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'file', mime: 'text/html' }).success).toBe(false);
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'file', mime: 'application/x-msdownload' }).success).toBe(false);
  });

  it('UploadUrlInput: hajm chegarasi turga qarab', () => {
    const big = 10 * 1024 * 1024 + 1;
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'image', size: big }).success).toBe(false);
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'file', mime: 'application/pdf', size: big }).success).toBe(true);
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'file', mime: 'application/pdf', size: 25 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(UploadUrlInputSchema.safeParse({ ...base, kind: 'image', size: 0 }).success).toBe(false);
  });

  it('UploadUrlInput: ovozli xabar uchun davomiylik kerak va 5 daqiqadan oshmaydi', () => {
    const voice = { ...base, kind: 'voice', mime: 'audio/webm;codecs=opus' };
    expect(UploadUrlInputSchema.safeParse(voice).success).toBe(false);
    expect(UploadUrlInputSchema.safeParse({ ...voice, durationMs: 4000 }).success).toBe(true);
    expect(UploadUrlInputSchema.safeParse({ ...voice, durationMs: MAX_VOICE_DURATION_MS + 1 }).success).toBe(false);
  });

  it('SendMessageInput: biriktirma bilan matn bo\'sh bo\'lishi mumkin', () => {
    expect(SendMessageInputSchema.safeParse({ content: '', attachmentId: uuid }).success).toBe(true);
    expect(SendMessageInputSchema.safeParse({ content: '' }).success).toBe(false);
    expect(WsSendMessageSchema.safeParse({ chatId: uuid, content: '', attachmentId: uuid }).success).toBe(true);
    expect(WsSendMessageSchema.safeParse({ chatId: uuid, content: '' }).success).toBe(false);
  });

  it('EditMessageInput: bo\'sh matn rad etiladi', () => {
    expect(EditMessageInputSchema.safeParse({ content: ' ' }).success).toBe(false);
    expect(EditMessageInputSchema.parse({ content: ' yangi ' }).content).toBe('yangi');
  });
});
