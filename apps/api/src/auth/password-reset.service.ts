import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseLoginIdentifier } from '@suhbat/core';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { RateLimiter } from '../common/rate-limiter';
import { Mailer } from '../mail/mailer';
import { passwordResetMail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './auth.service';

const MINUTE_MS = 60_000;
export const RESET_TOKEN_TTL_MINUTES = 30;
export const RESET_INVALID_MESSAGE = 'Havola yaroqsiz yoki muddati o\'tgan. Yangi havola so\'rang.';
export const RESET_NOT_CONFIGURED_MESSAGE = 'Email yuborish hozircha sozlanmagan';

const positive = (config: ConfigService, key: string, fallback: number) => {
  const n = Number(config.get<string>(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Parolni tiklash. Hisob bor-yo'qligi hech qachon oshkor qilinmaydi: so'rov javobi
 * bir xil, xat fonda yuboriladi (javob vaqti ham xatga bog'liq emas).
 * Cheklovlar: IP bo'yicha (xotirada, bitta API nusxasi) va hisob bo'yicha (bazadagi
 * so'nggi tokenlar soni) — hisob limiti oshsa xat jim yuborilmaydi.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly ipLimiter: RateLimiter;
  private readonly accountLimit: number;
  private readonly accountWindowMs: number;
  private readonly webUrl: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    config: ConfigService,
  ) {
    this.ipLimiter = new RateLimiter(
      positive(config, 'FORGOT_PASSWORD_IP_LIMIT', 5),
      positive(config, 'FORGOT_PASSWORD_IP_WINDOW_MS', 15 * MINUTE_MS),
    );
    this.accountLimit = positive(config, 'FORGOT_PASSWORD_ACCOUNT_LIMIT', 3);
    this.accountWindowMs = positive(config, 'FORGOT_PASSWORD_ACCOUNT_WINDOW_MS', 60 * MINUTE_MS);
    this.webUrl = config.get<string>('WEB_URL')?.trim().replace(/\/+$/, '') || null;
    if (mailer.configured && !this.webUrl) {
      this.logger.warn('WEB_URL yo\'q — xatdagi havolani yasab bo\'lmaydi, parolni tiklash o\'chiq');
    }
  }

  /** Email yuborish va `WEB_URL` sozlangan. */
  get available(): boolean {
    return this.mailer.configured && this.webUrl !== null;
  }

  async requestReset(identifier: string, ip: string): Promise<void> {
    // Sozlanmagan bo'lsa hamma uchun bir xil 503 — hisob borligiga bog'liq emas.
    if (!this.available) throw new ServiceUnavailableException(RESET_NOT_CONFIGURED_MESSAGE);
    if (!this.ipLimiter.take(ip)) {
      throw new HttpException('Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const id = parseLoginIdentifier(identifier);
    const user = await this.prisma.user.findUnique({
      where: id.kind === 'email' ? { email: id.value } : { username: id.value },
    });
    if (!user) return;

    const now = new Date();
    const recent = await this.prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - this.accountWindowMs) } },
    });
    if (recent >= this.accountLimit) {
      this.logger.warn(`Parol tiklash: hisob limiti (${user.id})`);
      return;
    }

    const token = randomBytes(32).toString('base64url');
    // Yangi havola so'ralganda eskilari bekor bo'ladi.
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * MINUTE_MS) },
      }),
    ]);

    const mail = passwordResetMail({
      to:          user.email,
      displayName: user.displayName,
      link:        `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`,
      ttlMinutes:  RESET_TOKEN_TTL_MINUTES,
    });
    void this.mailer.send(mail).catch((e: unknown) => {
      this.logger.error(`Parol tiklash xati yuborilmadi (${this.mailer.provider}): ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  /**
   * Token bir martalik: shartli yangilash bilan "olinadi" (parallel so'rovlardan faqat bittasi).
   * Parol yangilanadi, qolgan tiklash tokenlari va **barcha refresh token oilalari** bekor qilinadi.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt <= now) throw new BadRequestException(RESET_INVALID_MESSAGE);

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data:  { usedAt: now },
      });
      if (count === 0) throw new BadRequestException(RESET_INVALID_MESSAGE);
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    this.logger.log(`Parol tiklandi, sessiyalar yopildi (${row.userId})`);
  }
}
