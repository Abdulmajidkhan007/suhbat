import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

const HOUR_MS = 60 * 60 * 1000;
const BATCH = 100;

/**
 * Tugatilmagan yuklashlarni tozalaydi: imzolangan URL berilgan, lekin xabarga
 * biriktirilmagan (`messageId = null`) va `MEDIA_ORPHAN_TTL_HOURS` (24) soatdan
 * eski biriktirmalar — qator ham, saqlashdagi obyekt ham o'chadi. Davriy
 * (`MEDIA_CLEANUP_INTERVAL_MS`, standart 1 soat; 0 — o'chirilgan).
 *
 * Ketma-ketlik: avval qator (`messageId: null` sharti bilan — shu orada xabarga
 * biriktirilgan bo'lsa tegilmaydi), keyin obyekt. Obyektni o'chirib bo'lmasa
 * (log) u yetim bo'lib qoladi — qator allaqachon yo'q, qayta urinilmaydi.
 */
@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = Number(this.config.get<string>('MEDIA_CLEANUP_INTERVAL_MS') ?? HOUR_MS);
    if (!Number.isFinite(interval) || interval <= 0) return;
    this.timer = setInterval(() => void this.run().catch((e: Error) => this.logger.error('tozalash', e)), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get ttlMs(): number {
    const hours = Number(this.config.get<string>('MEDIA_ORPHAN_TTL_HOURS'));
    return (Number.isFinite(hours) && hours > 0 ? hours : 24) * HOUR_MS;
  }

  /** O'chirilgan biriktirmalar soni. Parallel chaqiruv e'tiborsiz (0). */
  async run(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const before = new Date(now.getTime() - this.ttlMs);
      let removed = 0;
      for (;;) {
        const rows = await this.prisma.attachment.findMany({
          where:   { messageId: null, createdAt: { lt: before } },
          select:  { id: true, key: true },
          orderBy: { createdAt: 'asc' },
          take:    BATCH,
        });
        let progressed = 0;
        for (const row of rows) {
          const { count } = await this.prisma.attachment.deleteMany({ where: { id: row.id, messageId: null } });
          if (count === 0) continue;
          progressed += 1;
          await this.storage.delete(row.key);
        }
        removed += progressed;
        if (rows.length < BATCH || progressed === 0) break;
      }
      if (removed > 0) this.logger.log(`tugatilmagan yuklashlar o'chirildi: ${removed}`);
      return removed;
    } finally {
      this.running = false;
    }
  }
}
