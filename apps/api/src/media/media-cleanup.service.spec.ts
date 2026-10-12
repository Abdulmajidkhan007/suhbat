import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { MediaCleanupService } from './media-cleanup.service';
import type { StorageService } from './storage.service';

const HOUR = 3_600_000;

describe('MediaCleanupService', () => {
  const prisma = { attachment: { findMany: vi.fn(), deleteMany: vi.fn() } };
  const storage = { delete: vi.fn() };
  let env: Record<string, string>;
  let service: MediaCleanupService;

  beforeEach(() => {
    vi.resetAllMocks();
    env = {};
    const config = { get: (k: string) => env[k] } as unknown as ConfigService;
    service = new MediaCleanupService(prisma as unknown as PrismaService, storage as unknown as StorageService, config);
  });

  it('24 soatdan eski, biriktirilmagan qatorlarni va obyektlarini o\'chiradi', async () => {
    const now = new Date('2026-10-12T12:00:00Z');
    prisma.attachment.findMany.mockResolvedValue([{ id: 'a', key: 'k/a' }, { id: 'b', key: 'k/b' }]);
    prisma.attachment.deleteMany.mockResolvedValue({ count: 1 });

    expect(await service.run(now)).toBe(2);

    const where = prisma.attachment.findMany.mock.calls[0][0].where;
    expect(where.messageId).toBeNull();
    expect(where.createdAt.lt).toEqual(new Date(now.getTime() - 24 * HOUR));
    expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({ where: { id: 'a', messageId: null } });
    expect(storage.delete.mock.calls.map((c) => c[0])).toEqual(['k/a', 'k/b']);
  });

  it('shu orada xabarga biriktirilgan qatorga (count 0) va uning obyektiga tegmaydi', async () => {
    prisma.attachment.findMany.mockResolvedValue([{ id: 'a', key: 'k/a' }]);
    prisma.attachment.deleteMany.mockResolvedValue({ count: 0 });
    expect(await service.run()).toBe(0);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('MEDIA_ORPHAN_TTL_HOURS sozlanadi', async () => {
    env.MEDIA_ORPHAN_TTL_HOURS = '2';
    prisma.attachment.findMany.mockResolvedValue([]);
    const now = new Date('2026-10-12T12:00:00Z');
    await service.run(now);
    expect(prisma.attachment.findMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date(now.getTime() - 2 * HOUR));
  });

  it('to\'liq sahifa bo\'lsa keyingisini ham oladi', async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, key: `k${i}` }));
    prisma.attachment.findMany.mockResolvedValueOnce(page).mockResolvedValueOnce([]);
    prisma.attachment.deleteMany.mockResolvedValue({ count: 1 });
    expect(await service.run()).toBe(100);
    expect(prisma.attachment.findMany).toHaveBeenCalledTimes(2);
  });
});
