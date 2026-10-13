import type { ConfigService } from '@nestjs/config';
import type { Message } from '@suhbat/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { FcmClient, FcmMessage, FcmResult } from './fcm.client';
import { PushService, buildNotification, previewText, runLimited } from './push.service';

const message: Message = {
  id:         '00000000-0000-4000-8000-0000000000a1',
  chatId:     '00000000-0000-4000-8000-0000000000c1',
  senderId:   'sender',
  type:       'text',
  content:    'salom   dunyo',
  attachment: null,
  createdAt:  new Date().toISOString(),
  editedAt:   null,
};

describe('previewText / buildNotification', () => {
  it('biriktirma turini va matnni ko\'rsatadi, uzun matnni qisqartiradi', () => {
    expect(previewText({ type: 'text', content: 'salom   dunyo' })).toBe('salom dunyo');
    expect(previewText({ type: 'image', content: '' })).toBe('📷 Rasm');
    expect(previewText({ type: 'voice', content: '' })).toBe('🎤 Ovozli xabar');
    expect(previewText({ type: 'file', content: 'hisobot' })).toBe('📎 Fayl: hisobot');
    expect(previewText({ type: 'text', content: 'a'.repeat(500) })).toHaveLength(200);
  });

  it('1:1 — yuboruvchi ismi; guruh — "Ism: matn"; kanal — kanal nomi', () => {
    const m = { type: 'text' as const, content: 'hey' };
    expect(buildNotification({ chatType: 'direct', chatTitle: null, senderName: 'Ali' }, m)).toEqual({ title: 'Ali', body: 'hey' });
    expect(buildNotification({ chatType: 'group', chatTitle: 'Oila', senderName: 'Ali' }, m)).toEqual({ title: 'Oila', body: 'Ali: hey' });
    expect(buildNotification({ chatType: 'channel', chatTitle: 'Yangiliklar', senderName: 'Ali' }, m)).toEqual({ title: 'Yangiliklar', body: 'hey' });
  });
});

describe('runLimited', () => {
  it('bir vaqtda `limit` tadan ko\'p ishlamaydi va hammasini bajaradi', async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await runLimited(Array.from({ length: 25 }, (_, i) => i), 4, async (i) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      done.push(i);
    });
    expect(peak).toBe(4);
    expect(done.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });
});

describe('PushService', () => {
  const prisma = {
    chat:        { findUnique: vi.fn() },
    user:        { findUnique: vi.fn(), findMany: vi.fn() },
    deviceToken: { deleteMany: vi.fn() },
  };
  const sent: { token: string; message: FcmMessage }[] = [];
  let results: Record<string, FcmResult> = {};
  const fcm = {
    enabled: true,
    send:    vi.fn(async (token: string, m: FcmMessage) => {
      sent.push({ token, message: m });
      return results[token] ?? 'ok';
    }),
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  let service: PushService;

  beforeEach(() => {
    vi.clearAllMocks();
    sent.length = 0;
    results = {};
    fcm.enabled = true;
    prisma.chat.findUnique.mockResolvedValue({ type: 'direct', title: null });
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Ali' });
    service = new PushService(prisma as unknown as PrismaService, fcm as unknown as FcmClient, config);
  });

  it('o\'chiq bo\'lsa bazaga ham murojaat qilmaydi', async () => {
    fcm.enabled = false;
    await service.notifyNewMessage(message, ['u1']);
    expect(prisma.chat.findUnique).not.toHaveBeenCalled();
  });

  it('o\'ziga va bo\'sh ro\'yxatga yubormaydi', async () => {
    await service.notifyNewMessage(message, ['sender']);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('preview sozlamasi: yoqilgan — matn, o\'chirilgan — "Yangi xabar"; data — chat va xabar id', async () => {
    prisma.user.findMany.mockResolvedValue([
      { notificationPreview: true, devices: [{ token: 'open-1' }, { token: 'open-2' }] },
      { notificationPreview: false, devices: [{ token: 'hidden' }] },
    ]);
    await service.notifyNewMessage(message, ['u1', 'u2']);
    const by = Object.fromEntries(sent.map((s) => [s.token, s.message]));
    expect(by['open-1']?.notification).toEqual({ title: 'Ali', body: 'salom dunyo' });
    expect(by['open-2']?.notification).toEqual({ title: 'Ali', body: 'salom dunyo' });
    expect(by.hidden?.notification).toEqual({ title: 'Suhbat', body: 'Yangi xabar' });
    expect(by.hidden?.data).toEqual({ type: 'message', chatId: message.chatId, messageId: message.id });
  });

  it('so\'rov bloklanganlarni ikki tomondan chiqaradi', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.notifyNewMessage(message, ['u1']);
    expect(prisma.user.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id:        { in: ['u1'] },
        blocking:  { none: { blockedId: 'sender' } },
        blockedBy: { none: { blockerId: 'sender' } },
      },
    });
  });

  it('yaroqsiz tokenlar o\'chiriladi, vaqtinchalik xatoli tokenlar qoladi', async () => {
    prisma.user.findMany.mockResolvedValue([
      { notificationPreview: true, devices: [{ token: 'dead' }, { token: 'flaky' }, { token: 'fine' }] },
    ]);
    results = { dead: 'invalid', flaky: 'error' };
    await service.notifyNewMessage(message, ['u1']);
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { token: { in: ['dead'] } } });
  });

  it('katta auditoriya bo\'laklab o\'qiladi (1000 tadan)', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.notifyNewMessage(message, Array.from({ length: 2500 }, (_, i) => `u${i}`));
    expect(prisma.user.findMany).toHaveBeenCalledTimes(3);
  });

  it('baza xatosi tashqariga chiqmaydi', async () => {
    prisma.chat.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.notifyNewMessage(message, ['u1'])).resolves.toBeUndefined();
  });
});
