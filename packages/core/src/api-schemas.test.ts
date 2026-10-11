import { describe, expect, it } from 'vitest';
import {
  CreateDirectChatInputSchema,
  MessagesQuerySchema,
  SendMessageInputSchema,
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
