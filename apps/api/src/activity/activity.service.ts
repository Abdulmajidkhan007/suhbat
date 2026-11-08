import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityMetaSchema } from '@suhbat/core';
import type { ActivityChatKind, ActivityMediaKind, ActivityMeta, ActivityType, Message } from '@suhbat/core';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientContext } from './request-context';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 90;
const DEVICE_MAX = 120;
const CHAT_CACHE_TTL_MS = 60_000;

export interface ActivityMedia {
  kind: ActivityMediaKind;
  mime: string;
  size: number;
  name: string;
  attachmentId: string;
}

export interface ActivityInput {
  type:    ActivityType;
  userId?: string | null;
  chatId?: string | null;
  ip?:     string | null;
  userAgent?: string | null;
  /** Faqat raqam/enum — `ActivityMetaSchema` bo'yicha oq ro'yxatdan o'tkaziladi. */
  meta?:   ActivityMeta;
  media?:  ActivityMedia;
}

/** Qurilma satri: boshqaruv belgilarisiz, qisqa. */
export const shortDevice = (ua: string | null | undefined): string | null => {
  // Boshqaruv belgilari (log injection) bo'shliqqa almashtiriladi.
  const clean = [...(ua ?? '')].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('').trim().slice(0, DEVICE_MAX);
  return clean || null;
};

/** Yuklangan fayl turi (ko'rsatish uchun): video MIME bo'yicha, qolgani biriktirma turi bo'yicha. */
export const mediaKindOf = (kind: 'image' | 'file' | 'voice', mime: string): ActivityMediaKind =>
  kind === 'voice' ? 'voice' : mime.startsWith('video/') ? 'video' : kind === 'image' ? 'image' : 'file';

/**
 * Faoliyat jurnali (REJA 6b). **Faqat metadata**: xabar matni va media mazmuni yozilmaydi (turlar bunga
 * joy qoldirmaydi: `meta` — oq ro'yxat). `record` asinxron va hech qachon tashlamaydi: jurnal xatosi
 * asosiy amalni buzmaydi, lekin log qilinadi. Saqlash muddati `ACTIVITY_RETENTION_DAYS` (90), kunlik tozalash.
 */
@Injectable()
export class ActivityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityService.name);
  private timer?: NodeJS.Timeout;
  private readonly chats = new Map<string, { at: number; kind: ActivityChatKind | null; isPublic: boolean | null }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get retentionDays(): number {
    const n = Number(this.config.get<string>('ACTIVITY_RETENTION_DAYS'));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_RETENTION_DAYS;
  }

  onModuleInit() {
    const interval = Number(this.config.get<string>('ACTIVITY_CLEANUP_INTERVAL_MS') ?? DAY_MS);
    if (!Number.isFinite(interval) || interval <= 0) return;
    this.timer = setInterval(() => void this.cleanup().catch((e: Error) => this.logger.error('jurnalni tozalash', e)), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Yozuvni fonda saqlaydi. Natijani kutish shart emas (testlarda `recordNow`). */
  record(input: ActivityInput): void {
    void this.recordNow(input);
  }

  async recordNow(input: ActivityInput): Promise<void> {
    try {
      const chat = input.chatId ? await this.chatInfo(input.chatId) : null;
      const meta = input.meta ? ActivityMetaSchema.parse(input.meta) : undefined;
      await this.prisma.activityLog.create({
        data: {
          type:         input.type,
          userId:       input.userId ?? null,
          chatId:       input.chatId ?? null,
          chatKind:     chat?.kind ?? null,
          chatPublic:   chat?.kind === 'channel' ? chat.isPublic : null,
          ip:           input.ip?.slice(0, 64) ?? null,
          device:       shortDevice(input.userAgent),
          meta:         meta as Prisma.InputJsonValue | undefined,
          mediaKind:    input.media?.kind ?? null,
          mime:         input.media?.mime ?? null,
          size:         input.media?.size ?? null,
          fileName:     input.media?.name.slice(0, 255) ?? null,
          attachmentId: input.media?.attachmentId ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`jurnalga yozilmadi (${input.type}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Yuborilgan xabar: `message_send` (faqat uzunlik va biriktirma bor-yo'qligi — MATN yozilmaydi) va
   * biriktirma bo'lsa `media_upload` (tur, MIME, hajm, nom).
   */
  messageSent(ctx: ClientContext, userId: string, message: Message): void {
    this.record({
      type: 'message_send', userId, chatId: message.chatId, ...ctx,
      meta: { length: message.content.length, hasAttachment: message.attachment !== null },
    });
    const a = message.attachment;
    if (a) {
      this.record({
        type: 'media_upload', userId, chatId: message.chatId, ...ctx,
        media: { kind: mediaKindOf(a.kind, a.mime), mime: a.mime, size: a.size, name: a.name, attachmentId: a.id },
      });
    }
  }

  /** `retentionDays` dan eski yozuvlarni o'chiradi; o'chirilgan soni. */
  async cleanup(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - this.retentionDays * DAY_MS);
    const { count } = await this.prisma.activityLog.deleteMany({ where: { createdAt: { lt: before } } });
    if (count > 0) this.logger.log(`faoliyat jurnali: ${count} ta eski yozuv o'chirildi (${this.retentionDays} kundan eski)`);
    return count;
  }

  private async chatInfo(chatId: string) {
    const hit = this.chats.get(chatId);
    if (hit && Date.now() - hit.at < CHAT_CACHE_TTL_MS) return hit;
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { type: true, isPublic: true } });
    const info = {
      at:       Date.now(),
      kind:     chat ? (chat.type === 'direct' ? 'private' : chat.type) as ActivityChatKind : null,
      isPublic: chat ? chat.isPublic : null,
    };
    if (this.chats.size > 5000) this.chats.clear();
    this.chats.set(chatId, info);
    return info;
  }
}
