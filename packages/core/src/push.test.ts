import { describe, expect, it } from 'vitest';
import {
  LogoutInputSchema,
  PushDataSchema,
  RegisterDeviceInputSchema,
  UpdateNotificationSettingsInputSchema,
} from './push.js';

describe('RegisterDeviceInputSchema', () => {
  it('platforma va tokenni qabul qiladi', () => {
    expect(RegisterDeviceInputSchema.parse({ platform: 'android', token: ' abc ' })).toEqual({
      platform: 'android',
      token:    'abc',
    });
  });

  it('noma\'lum platforma va bo\'sh tokenni rad etadi', () => {
    expect(RegisterDeviceInputSchema.safeParse({ platform: 'symbian', token: 'x' }).success).toBe(false);
    expect(RegisterDeviceInputSchema.safeParse({ platform: 'ios', token: '  ' }).success).toBe(false);
  });
});

describe('LogoutInputSchema', () => {
  it('deviceToken ixtiyoriy', () => {
    expect(LogoutInputSchema.safeParse({ refreshToken: 'r' }).success).toBe(true);
    expect(LogoutInputSchema.parse({ refreshToken: 'r', deviceToken: 't' }).deviceToken).toBe('t');
  });
});

describe('UpdateNotificationSettingsInputSchema', () => {
  it('bo\'sh obyektni rad etadi', () => {
    expect(UpdateNotificationSettingsInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateNotificationSettingsInputSchema.parse({ preview: false })).toEqual({ preview: false });
  });
});

describe('PushDataSchema', () => {
  it('faqat message turini qabul qiladi', () => {
    const id = '7d5b8f3e-6b1a-4a43-9a51-0f6f3b2a1c11';
    expect(PushDataSchema.safeParse({ type: 'message', chatId: id, messageId: id }).success).toBe(true);
    expect(PushDataSchema.safeParse({ type: 'call', chatId: id, messageId: id }).success).toBe(false);
  });
});
