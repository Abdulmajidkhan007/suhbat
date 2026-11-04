import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';
import type { StorageService } from './storage.service';

const me = '00000000-0000-4000-8000-000000000001';
const chatId = '00000000-0000-4000-8000-0000000000c1';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const row = { id: 'a1', key: 'chats/c/a1', kind: 'image', mime: 'image/png', size: 100, name: 'x.png', durationMs: null };

describe('MediaService', () => {
  const prisma = { attachment: { create: vi.fn(), findFirst: vi.fn() } };
  const storage = { presignPut: vi.fn(), presignGet: vi.fn(), head: vi.fn(), readHead: vi.fn(), delete: vi.fn() };
  let service: MediaService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new MediaService(prisma as unknown as PrismaService, storage as unknown as StorageService);
  });

  it('createUpload: kalitda foydalanuvchi nomi yo\'q; imzo hajm va turga bog\'langan', async () => {
    storage.presignPut.mockResolvedValue({ url: 'http://s3/put', headers: { 'Content-Type': 'image/png' } });
    const res = await service.createUpload(me, {
      chatId, kind: 'image', name: '../../etc/passwd.png', mime: 'image/png', size: 100,
    });
    const data = prisma.attachment.create.mock.calls[0][0].data;
    expect(data.key).toBe(`chats/${chatId}/${data.id}`);
    expect(data.messageId).toBeUndefined();
    expect(storage.presignPut).toHaveBeenCalledWith(data.key, 'image/png', 100);
    expect(res).toMatchObject({ attachmentId: data.id, uploadUrl: 'http://s3/put', headers: { 'Content-Type': 'image/png' } });
  });

  it('requireReady: begona/ishlatilgan biriktirma — 400', async () => {
    prisma.attachment.findFirst.mockResolvedValue(null);
    await expect(service.requireReady('a1', me, chatId)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.attachment.findFirst.mock.calls[0][0].where).toEqual({
      id: 'a1', uploaderId: me, chatId, messageId: null,
    });
  });

  it('requireReady: yuklanmagan — 400; hajm/tur mos emas — 400 va obyekt o\'chadi', async () => {
    prisma.attachment.findFirst.mockResolvedValue(row);
    storage.head.mockResolvedValue(null);
    await expect(service.requireReady('a1', me, chatId)).rejects.toThrow('yuklanmagan');

    storage.head.mockResolvedValue({ size: 999, mime: 'image/png' });
    await expect(service.requireReady('a1', me, chatId)).rejects.toThrow('mos emas');
    storage.head.mockResolvedValue({ size: 100, mime: 'text/html' });
    await expect(service.requireReady('a1', me, chatId)).rejects.toThrow('mos emas');
    expect(storage.delete).toHaveBeenCalledTimes(2);

    storage.head.mockResolvedValue({ size: 100, mime: 'image/png' });
    storage.readHead.mockResolvedValue(PNG);
    await expect(service.requireReady('a1', me, chatId)).resolves.toBe(row);
  });

  it('requireReady: Content-Type "image/png", lekin ichi HTML/SVG/skript — 400 va obyekt o\'chadi', async () => {
    prisma.attachment.findFirst.mockResolvedValue(row);
    storage.head.mockResolvedValue({ size: 100, mime: 'image/png' });
    for (const body of ['<!doctype html><script>alert(1)</script>', '<svg xmlns="x"><script/></svg>', '#!/bin/sh\nrm -rf /']) {
      storage.readHead.mockResolvedValue(Buffer.from(body));
      await expect(service.requireReady('a1', me, chatId)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(storage.delete).toHaveBeenCalledTimes(3);
  });

  it('requireReady: nomi mazmuniga mos kelmasa rad (rasm.png, lekin ichi PDF)', async () => {
    prisma.attachment.findFirst.mockResolvedValue({ ...row, mime: 'application/pdf', name: 'rasm.png', kind: 'file' });
    storage.head.mockResolvedValue({ size: 100, mime: 'application/pdf' });
    storage.readHead.mockResolvedValue(Buffer.from('%PDF-1.7\n'));
    await expect(service.requireReady('a1', me, chatId)).rejects.toThrow('kengaytmasi');
    expect(storage.delete).toHaveBeenCalledWith(row.key);
  });

  it('requireReady: saqlashga ulanib bo\'lmasa — tushunarli 503', async () => {
    prisma.attachment.findFirst.mockResolvedValue(row);
    storage.head.mockRejectedValue(new Error('connect ECONNREFUSED'));
    await expect(service.requireReady('a1', me, chatId)).rejects.toThrow('Fayl saqlash hozir mavjud emas');
  });

  it('toDto: rasm inline, fayl attachment sifatida imzolanadi', async () => {
    storage.presignGet.mockResolvedValue('http://s3/get');
    await service.toDto(row as never);
    await service.toDto({ ...row, kind: 'file', mime: 'application/pdf' } as never);
    expect(storage.presignGet.mock.calls[0][1]).toMatchObject({ inline: true });
    expect(storage.presignGet.mock.calls[1][1]).toMatchObject({ inline: false });
  });
});
