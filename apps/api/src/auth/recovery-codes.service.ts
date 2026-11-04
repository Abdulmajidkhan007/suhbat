import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  parseLoginIdentifier,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from '@suhbat/core';
import type { RecoverInput, RecoveryCodesStatus } from '@suhbat/core';
import * as argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { CodeAttemptGuard, retryAfterSeconds } from '../common/code-attempt-guard';
import { RateLimiter } from '../common/rate-limiter';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE_MS = 60_000;
export const RECOVER_FAILED_MESSAGE = 'Login yoki tiklash kodi noto\'g\'ri';
export const RECOVER_LIMIT_MESSAGE = 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
export const recoverBlockedMessage = (ms: number) =>
  `Juda ko'p noto'g'ri kod kiritildi. ${Math.ceil(retryAfterSeconds(ms) / 60)} daqiqadan keyin qayta urinib ko'ring.`;
export const WRONG_PASSWORD_MESSAGE = 'Joriy parol noto\'g\'ri';

const positive = (config: ConfigService, key: string, fallback: number) => {
  const n = Number(config.get<string>(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Kriptografik tasodifiy kod: 32 harfli alifbo, har bayt `& 31` — bir tekis taqsimot (256 % 32 = 0). */
export const generateRecoveryCode = (): string => {
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let out = '';
  for (const b of bytes) out += RECOVERY_CODE_ALPHABET[b & 31];
  return out;
};

/**
 * Emailsiz parol tiklash — bir martalik kodlar (10 ta, 60 bit).
 *
 * **Saqlash: HMAC-SHA256 (pepper bilan), argon2 emas.** Kodlar tasodifiy va yuqori entropiyali
 * (60 bit) — parol kabi lug'at bilan terib bo'lmaydi, sekin hash kerak emas. argon2 bilan har
 * urinishda 10 tagacha sekin tekshiruv bo'lardi (CPU bo'yicha DoS). Pepper bazada emas
 * (`RECOVERY_CODE_PEPPER` yoki `JWT_SECRET` dan hosil qilinadi) — baza sizsa ham kodlarni
 * offlayn terib bo'lmaydi. Eslatma: pepper (yoki unga asos bo'lgan `JWT_SECRET`) almashtirilsa
 * mavjud kodlar yaroqsiz bo'ladi — foydalanuvchi sozlamalarda yangisini yaratadi.
 *
 * Cheklov: IP bo'yicha (so'rovlar soni) va login bo'yicha (`CodeAttemptGuard`: 5 ta noto'g'ri kod →
 * 15 daqiqa blok; mavjud bo'lmagan login ham sanaladi — javob va cheklov hisob borligini oshkor
 * qilmaydi). Xotirada (bitta API nusxasi).
 */
@Injectable()
export class RecoveryCodesService {
  private readonly logger = new Logger(RecoveryCodesService.name);
  private readonly pepper: Buffer;
  private readonly ipLimiter: RateLimiter;
  private readonly attempts: CodeAttemptGuard;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const explicit = config.get<string>('RECOVERY_CODE_PEPPER');
    this.pepper = explicit
      ? Buffer.from(explicit)
      : createHmac('sha256', config.getOrThrow<string>('JWT_SECRET')).update('suhbat-recovery-v1').digest();
    this.ipLimiter = new RateLimiter(
      positive(config, 'RECOVER_IP_LIMIT', 10),
      positive(config, 'RECOVER_IP_WINDOW_MS', 15 * MINUTE_MS),
    );
    this.attempts = new CodeAttemptGuard({
      maxFailures: positive(config, 'CODE_MAX_FAILURES', 5),
      blockMs:     positive(config, 'CODE_BLOCK_MS', 15 * MINUTE_MS),
      cooldownMs:  0, // tiklash kodi o'zi so'ralmaydi (oldindan berilgan) — kutish faqat email havolada
    });
  }

  hash(normalized: string): string {
    return createHmac('sha256', this.pepper).update(normalized).digest('hex');
  }

  /** Eski kodlar o'chadi, yangi 10 ta yaratiladi. Ochiq kodlar faqat shu yerda qaytadi (`XXXX-XXXX-XXXX`). */
  async generate(userId: string): Promise<string[]> {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateRecoveryCode());
    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({ data: [...codes].map((c) => ({ userId, codeHash: this.hash(c) })) }),
    ]);
    return [...codes].map(formatRecoveryCode);
  }

  /** Joriy parol bilan tasdiqlab qayta yaratish. */
  async regenerate(userId: string, password: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await argon2.verify(user.passwordHash, password))) throw new BadRequestException(WRONG_PASSWORD_MESSAGE);
    return this.generate(userId);
  }

  async status(userId: string): Promise<RecoveryCodesStatus> {
    const [remaining, last] = await Promise.all([
      this.prisma.recoveryCode.count({ where: { userId, usedAt: null } }),
      this.prisma.recoveryCode.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return { remaining, generatedAt: last?.createdAt.toISOString() ?? null };
  }

  /**
   * Kod to'g'ri va ishlatilmagan bo'lsa: kod "olinadi" (shartli `updateMany` — parallel
   * so'rovlardan faqat bittasi), parol yangilanadi, barcha refresh tokenlar va email tiklash
   * havolalari bekor qilinadi. Har qanday xato — bir xil 400 (hisob borligi oshkor bo'lmaydi).
   */
  async recover(input: RecoverInput, ip: string): Promise<void> {
    const id = parseLoginIdentifier(input.login);
    if (!this.ipLimiter.take(ip)) throw new HttpException(RECOVER_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    // Identifikator blokda bo'lsa kod tekshirilmaydi ham (to'g'ri kod ham o'tmaydi).
    const key = `recover:${id.kind}:${id.value}`;
    const blocked = this.attempts.blockedFor(key);
    if (blocked > 0) throw new HttpException(recoverBlockedMessage(blocked), HttpStatus.TOO_MANY_REQUESTS);
    /** Noto'g'ri urinish: sanaladi; limitga yetgan urinish — 429, qolgani — bir xil 400. */
    const fail = (): never => {
      const block = this.attempts.recordFailure(key);
      if (block > 0) {
        this.logger.warn(`Tiklash kodi: ${id.kind} bloklandi (${Math.round(block / MINUTE_MS)} daqiqa)`);
        throw new HttpException(recoverBlockedMessage(block), HttpStatus.TOO_MANY_REQUESTS);
      }
      throw new BadRequestException(RECOVER_FAILED_MESSAGE);
    };
    const code = normalizeRecoveryCode(input.code);
    const user = await this.prisma.user.findUnique({
      where: id.kind === 'email' ? { email: id.value } : { username: id.value },
      select: { id: true },
    });
    if (!user || !code) return fail();

    const codeHash = this.hash(code);
    const row = await this.prisma.recoveryCode.findUnique({
      where: { userId_codeHash: { userId: user.id, codeHash } },
    });
    if (!row || row.usedAt) return fail();

    const passwordHash = await argon2.hash(input.newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.recoveryCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (count === 0) return fail();
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    });
    this.attempts.recordSuccess(key);
    this.logger.log(`Parol tiklash kodi bilan tiklandi, sessiyalar yopildi (${user.id})`);
  }
}
