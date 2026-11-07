import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RECOVERY_CODE_COUNT } from '@suhbat/core';
import type {
  AdminAuditAction, AdminAuditList, AdminBulkDeleteResult, AdminUser, AdminUserList,
} from '@suhbat/core';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { RecoveryCodesService } from '../auth/recovery-codes.service';
import { isAdminEmail } from '../common/admin-emails';
import { ChatGateway } from '../chats/chat.gateway';
import type { Prisma } from '../generated/prisma/client';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminActor {
  id:    string;
  email: string;
}

export const SELF_ACTION_MESSAGE = 'Bu amalni o\'zingizga qo\'llab bo\'lmaydi';
export const USER_NOT_FOUND_MESSAGE = 'Foydalanuvchi topilmadi';

/** Chalkash belgilarsiz (0/O, 1/l/I) alifbo; 16 belgi ≈ 90 bit. `& 31` + 32 harfli alifbo — bir tekis. */
const TEMP_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789A';
export const TEMP_PASSWORD_LENGTH = 16;
export const generateTempPassword = (): string => {
  let out = '';
  for (const b of randomBytes(TEMP_PASSWORD_LENGTH)) out += TEMP_PASSWORD_ALPHABET[b & 31];
  return out.match(/.{4}/g)!.join('-');
};

/** `select` — parol hash'i va kodlar bazadan o'qilmaydi ham. */
const LIST_SELECT = {
  id: true, username: true, displayName: true, email: true, createdAt: true,
  lastSeenAt: true, blockedAt: true, mustChangePassword: true,
} satisfies Prisma.UserSelect;

const TARGET_SELECT = { id: true, email: true, username: true, displayName: true } satisfies Prisma.UserSelect;
type Target = Prisma.UserGetPayload<{ select: typeof TARGET_SELECT }>;
const labelOf = (u: Target) => (u.username ? `@${u.username}` : u.email);

/** Admin amallari. Har bir o'zgartiruvchi amal `AdminAuditLog` ga yoziladi. */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: RecoveryCodesService,
    private readonly gateway: ChatGateway,
    private readonly media: MediaService,
  ) {}

  async listUsers(q: string, page: number, pageSize: number): Promise<AdminUserList> {
    const term = q.replace(/^@/, '');
    const where: Prisma.UserWhereInput = term
      ? {
          OR: [
            { username:    { contains: term, mode: 'insensitive' } },
            { email:       { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, select: LIST_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    const ids = rows.map((r) => r.id);
    const now = new Date();
    const [sessions, codes] = await Promise.all([
      // Bir qurilma = bitta token oilasi (rotatsiyada oila saqlanadi).
      this.prisma.refreshToken.groupBy({
        by: ['userId', 'familyId'],
        where: { userId: { in: ids }, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.recoveryCode.groupBy({ by: ['userId'], where: { userId: { in: ids }, usedAt: null } }),
    ]);
    const sessionCount = new Map<string, number>();
    for (const s of sessions) sessionCount.set(s.userId, (sessionCount.get(s.userId) ?? 0) + 1);
    const withCodes = new Set(codes.map((c) => c.userId));
    const items: AdminUser[] = rows.map((r) => ({
      id:                 r.id,
      username:           r.username,
      displayName:        r.displayName,
      email:              r.email,
      createdAt:          r.createdAt.toISOString(),
      lastSeenAt:         r.lastSeenAt?.toISOString() ?? null,
      hasRecoveryCodes:   withCodes.has(r.id),
      activeSessions:     sessionCount.get(r.id) ?? 0,
      blocked:            r.blockedAt !== null,
      mustChangePassword: r.mustChangePassword,
      isAdmin:            isAdminEmail(r.email),
    }));
    return { items, total, page, pageSize };
  }

  async block(admin: AdminActor, id: string): Promise<void> {
    this.notSelf(admin, id);
    const target = await this.target(id);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { blockedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await this.audit(tx, admin, 'user.block', target);
    });
    this.gateway.disconnectUser(id);
  }

  async unblock(admin: AdminActor, id: string): Promise<void> {
    const target = await this.target(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { blockedAt: null } });
      await this.audit(tx, admin, 'user.unblock', target);
    });
  }

  async revokeSessions(admin: AdminActor, id: string): Promise<void> {
    const target = await this.target(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tx, admin, 'user.revoke_sessions', target);
    });
    this.gateway.disconnectUser(id);
  }

  /** Parol bir marta qaytadi; keyingi kirishda almashtirish majburiy. Eski sessiyalar va email havolalari bekor. */
  async setTempPassword(admin: AdminActor, id: string): Promise<string> {
    this.notSelf(admin, id);
    const target = await this.target(id);
    const temporaryPassword = generateTempPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: now } });
      await this.audit(tx, admin, 'user.temp_password', target);
    });
    this.gateway.disconnectUser(id);
    return temporaryPassword;
  }

  /** Eski kodlar bekor, yangi `RECOVERY_CODE_COUNT` ta — ochiq holda faqat shu javobda. */
  async regenerateRecoveryCodes(admin: AdminActor, id: string): Promise<string[]> {
    const target = await this.target(id);
    const codes = await this.recovery.generate(id);
    if (codes.length !== RECOVERY_CODE_COUNT) throw new Error('tiklash kodlari to\'liq yaratilmadi');
    await this.audit(this.prisma, admin, 'user.recovery_codes', target);
    return codes;
  }

  async deleteOne(admin: AdminActor, id: string): Promise<void> {
    this.notSelf(admin, id);
    const { notFound } = await this.deleteMany(admin, [id]);
    if (notFound.length > 0) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
  }

  /**
   * O'zini o'chirib bo'lmaydi (ro'yxatda bo'lsa — butun so'rov 400, hech kim o'chmaydi).
   * Bitta foydalanuvchi — bitta tranzaksiya: yarim o'chib qolmaydi; biri xato qilsa, oldingilari o'chgan holda qoladi.
   */
  async deleteMany(admin: AdminActor, ids: string[]): Promise<AdminBulkDeleteResult> {
    const unique = [...new Set(ids)];
    if (unique.includes(admin.id)) throw new BadRequestException(SELF_ACTION_MESSAGE);
    const deleted: string[] = [];
    const notFound: string[] = [];
    for (const id of unique) {
      const target = await this.prisma.user.findUnique({ where: { id }, select: TARGET_SELECT });
      if (!target) {
        notFound.push(id);
        continue;
      }
      const keys = await this.prisma.$transaction(async (tx) => {
        const chatsGone = await this.detachFromChats(tx, id);
        const files = await tx.attachment.findMany({
          where:  { OR: [{ uploaderId: id }, { chatId: { in: chatsGone } }] },
          select: { key: true },
        });
        await tx.chat.deleteMany({ where: { id: { in: chatsGone } } });
        await tx.user.delete({ where: { id } });
        await this.audit(tx, admin, 'user.delete', target);
        return files.map((f) => f.key);
      });
      deleted.push(id);
      this.gateway.disconnectUser(id);
      // Saqlashdagi fayllar: xato bo'lsa ham hisob allaqachon o'chgan — faqat yetim fayl qoladi (tozalagich/qo'lda).
      await this.media.removeObjects(keys).catch((e: unknown) => {
        this.logger.warn(`fayllar o'chmadi (${id}): ${e instanceof Error ? e.message : String(e)}`);
      });
    }
    return { deleted, notFound };
  }

  async listAudit(page: number, pageSize: number): Promise<AdminAuditList> {
    const [total, rows] = await Promise.all([
      this.prisma.adminAuditLog.count(),
      this.prisma.adminAuditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return {
      total, page, pageSize,
      items: rows.map((r) => ({
        id:           r.id,
        adminId:      r.adminId,
        adminEmail:   r.adminEmail,
        action:       r.action as AdminAuditAction,
        targetUserId: r.targetUserId,
        targetLabel:  r.targetLabel,
        createdAt:    r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Foydalanuvchi o'chishidan oldin chatlarni tartiblaydi: 1:1 chatlar va undan boshqa a'zosi
   * qolmagan guruh/kanallar o'chadi (id'lari qaytadi); egasi ketayotgan guruhga yangi ega
   * (eng eski admin, bo'lmasa eng eski a'zo) tayinlanadi.
   */
  private async detachFromChats(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const mine = await tx.chatMember.findMany({
      where: { userId }, select: { chatId: true, role: true, chat: { select: { type: true } } },
    });
    const gone: string[] = [];
    for (const m of mine) {
      if (m.chat.type === 'direct') {
        gone.push(m.chatId);
        continue;
      }
      const others = await tx.chatMember.findMany({
        where: { chatId: m.chatId, userId: { not: userId } }, orderBy: { joinedAt: 'asc' }, select: { userId: true, role: true },
      });
      if (others.length === 0) gone.push(m.chatId);
      else if (m.role === 'owner' && !others.some((o) => o.role === 'owner')) {
        const heir = others.find((o) => o.role === 'admin') ?? others[0];
        await tx.chatMember.update({
          where: { chatId_userId: { chatId: m.chatId, userId: heir.userId } }, data: { role: 'owner' },
        });
      }
    }
    return gone;
  }

  private notSelf(admin: AdminActor, id: string): void {
    if (admin.id === id) throw new BadRequestException(SELF_ACTION_MESSAGE);
  }

  private async target(id: string): Promise<Target> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: TARGET_SELECT });
    if (!user) throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    return user;
  }

  private async audit(
    db: Pick<Prisma.TransactionClient, 'adminAuditLog'>,
    admin: AdminActor,
    action: AdminAuditAction,
    target: Target,
  ): Promise<void> {
    await db.adminAuditLog.create({
      data: { adminId: admin.id, adminEmail: admin.email, action, targetUserId: target.id, targetLabel: labelOf(target) },
    });
  }
}
