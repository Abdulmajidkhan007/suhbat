import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityMetaSchema } from '@suhbat/core';
import type {
  ActivityChatKind, ActivityMediaKind, AdminActivityEntry, AdminActivityList, AdminActivityQuery, AdminMediaList,
  AdminMediaPreview, AdminMediaQuery, AdminOverview, AdminReportList,
} from '@suhbat/core';
import { mediaKindOf } from '../activity/activity.service';
import type { ActivityLog, Prisma } from '../generated/prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';

export const MEDIA_PRIVATE_MESSAGE = 'Bu media maxfiy: faqat metadata ko\'rinadi (ochiq kanal yoki shikoyat qilingan xabar bundan mustasno)';
const DAY_MS = 24 * 60 * 60 * 1000;

const labelOf = (u: { displayName: string; username: string | null; email: string }) =>
  `${u.displayName} (${u.username ? `@${u.username}` : u.email})`;

/**
 * Faoliyat jurnali, media va shikoyatlar (admin). **Maxfiylik chegarasi (kodda):** xabar MATNI hech qaysi
 * javobda yo'q (jurnalda ham yo'q); media mazmuniga (prevyu URL) faqat ochiq kanal biriktirmasi yoki
 * shikoyat qilingan xabar biriktirmasi uchun ruxsat; shikoyat qilingan xabargina matni bilan qaytadi.
 */
@Injectable()
export class AdminActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async overview(now = new Date()): Promise<AdminOverview> {
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = new Date(now.getTime() - DAY_MS);
    const [usersTotal, newUsersToday, active, last24, total] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(DISTINCT user_id)::int AS n FROM activity_log
        WHERE created_at >= ${startOfDay} AND user_id IS NOT NULL AND type <> 'login_failed'`,
      this.prisma.attachment.aggregate({ _sum: { size: true }, where: { messageId: { not: null }, createdAt: { gte: day } } }),
      this.prisma.attachment.aggregate({ _sum: { size: true }, where: { messageId: { not: null } } }),
    ]);
    return {
      usersTotal, newUsersToday,
      activeToday:     active[0]?.n ?? 0,
      mediaBytes24h:   last24._sum.size ?? 0,
      mediaBytesTotal: total._sum.size ?? 0,
    };
  }

  async listActivity(q: AdminActivityQuery): Promise<AdminActivityList> {
    const where: Prisma.ActivityLogWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.chatKind ? { chatKind: q.chatKind } : {}),
      ...((q.from || q.to) ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) } } : {}),
    };
    return this.page(where, q.page, q.pageSize);
  }

  async listMedia(q: AdminMediaQuery): Promise<AdminMediaList> {
    const where: Prisma.ActivityLogWhereInput = {
      type: 'media_upload',
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.chatKind ? { chatKind: q.chatKind } : {}),
      ...(q.kind ? { mediaKind: q.kind } : {}),
    };
    const [list, stats] = await Promise.all([this.page(where, q.page, q.pageSize), this.mediaStats()]);
    return { ...list, stats };
  }

  /** Saqlangan media bo'yicha jami (jurnal muddati bilan cheklanmagan). */
  private async mediaStats(): Promise<AdminMediaList['stats']> {
    const attached = { messageId: { not: null } };
    const [rows, video] = await Promise.all([
      this.prisma.attachment.groupBy({ by: ['kind'], where: attached, _count: { _all: true }, _sum: { size: true } }),
      this.prisma.attachment.aggregate({ where: { ...attached, kind: 'file', mime: { startsWith: 'video/' } }, _count: { _all: true }, _sum: { size: true } }),
    ]);
    const acc = new Map<ActivityMediaKind, { count: number; bytes: number }>();
    const add = (k: ActivityMediaKind, count: number, bytes: number) => {
      const cur = acc.get(k) ?? { count: 0, bytes: 0 };
      acc.set(k, { count: cur.count + count, bytes: cur.bytes + bytes });
    };
    for (const r of rows) add(mediaKindOf(r.kind, ''), r._count._all, r._sum.size ?? 0);
    if (video._count._all > 0) { // video "file" turida saqlanadi — alohida ko'rsatiladi
      add('file', -video._count._all, -(video._sum.size ?? 0));
      add('video', video._count._all, video._sum.size ?? 0);
    }
    const byKind = [...acc.entries()].map(([kind, v]) => ({ kind, ...v })).filter((k) => k.count > 0);
    return {
      byKind,
      totalCount: byKind.reduce((n, k) => n + k.count, 0),
      totalBytes: byKind.reduce((n, k) => n + k.bytes, 0),
    };
  }

  private async page(where: Prisma.ActivityLogWhereInput, page: number, pageSize: number): Promise<AdminActivityList> {
    const [total, rows] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => id !== null))];
    const attachmentIds = rows.map((r) => r.attachmentId).filter((id): id is string => id !== null);
    const [users, previewable] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true, email: true } }),
      this.previewableSet(attachmentIds),
    ]);
    const labels = new Map(users.map((u) => [u.id, labelOf(u)]));
    return { total, page, pageSize, items: rows.map((r) => this.entry(r, labels, previewable)) };
  }

  private entry(r: ActivityLog, labels: Map<string, string>, previewable: Set<string>): AdminActivityEntry {
    const meta = ActivityMetaSchema.safeParse(r.meta);
    return {
      id:         r.id,
      type:       r.type,
      userId:     r.userId,
      userLabel:  r.userId ? (labels.get(r.userId) ?? null) : null,
      chatId:     r.chatId,
      chatKind:   (r.chatKind as ActivityChatKind | null) ?? null,
      chatPublic: r.chatPublic,
      ip:         r.ip,
      device:     r.device,
      meta:       meta.success ? meta.data : null,
      media:      r.mediaKind
        ? {
            kind: r.mediaKind as ActivityMediaKind, mime: r.mime ?? '', size: r.size ?? 0, name: r.fileName ?? '',
            attachmentId: r.attachmentId, previewable: r.attachmentId !== null && previewable.has(r.attachmentId),
          }
        : null,
      createdAt:  r.createdAt.toISOString(),
    };
  }

  /** Hozirgi holat bo'yicha: ochiq kanal biriktirmasi yoki shikoyat qilingan xabar biriktirmasi. */
  private async previewableSet(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.attachment.findMany({
      where: {
        id: { in: ids },
        OR: [{ chat: { type: 'channel', isPublic: true } }, { message: { reports: { some: {} } } }],
      },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /** Prevyu URL'i faqat ruxsat etilgan hollarda; boshqasi — 403 (mazmun hech qachon berilmaydi). */
  async previewMedia(attachmentId: string): Promise<AdminMediaPreview> {
    const row = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!row || !row.messageId) throw new NotFoundException('Media topilmadi');
    if (!(await this.previewableSet([attachmentId])).has(attachmentId)) throw new ForbiddenException(MEDIA_PRIVATE_MESSAGE);
    const dto = await this.media.toDto(row);
    return { url: dto.url, name: row.name, mime: row.mime, kind: mediaKindOf(row.kind, row.mime) };
  }

  /** Shikoyat qilingan xabarlar — YAGONA joy, unda xabar matni adminga ko'rinadi. */
  async listReports(page: number, pageSize: number): Promise<AdminReportList> {
    const [total, rows] = await Promise.all([
      this.prisma.messageReport.count(),
      this.prisma.messageReport.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
        include: {
          reporter: { select: { displayName: true, username: true, email: true } },
          message: {
            include: {
              sender:     { select: { displayName: true, username: true, email: true } },
              chat:       { select: { type: true } },
              attachment: { select: { id: true } },
            },
          },
        },
      }),
    ]);
    return {
      total, page, pageSize,
      items: rows.map((r) => ({
        id:            r.id,
        createdAt:     r.createdAt.toISOString(),
        reason:        r.reason,
        reporterLabel: labelOf(r.reporter),
        chatKind:      r.message.chat.type === 'direct' ? 'private' : r.message.chat.type,
        message: {
          id:           r.message.id,
          chatId:       r.message.chatId,
          senderId:     r.message.senderId,
          senderLabel:  labelOf(r.message.sender),
          type:         r.message.type,
          content:      r.message.deletedAt ? '' : r.message.content,
          createdAt:    r.message.createdAt.toISOString(),
          deleted:      r.message.deletedAt !== null,
          attachmentId: r.message.attachment?.id ?? null,
        },
      })),
    };
  }
}
