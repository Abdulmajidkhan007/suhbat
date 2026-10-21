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
import { RateLimiter } from '../common/rate-limiter';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE_MS = 60_000;
export const RECOVER_FAILED_MESSAGE = 'Login yoki tiklash kodi noto\'g\'ri';
export const RECOVER_LIMIT_MESSAGE = 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
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
 * Cheklov: IP bo'yicha va login bo'yicha (mavjud bo'lmagan login ham sanaladi — javob va
 * cheklov hisob borligini oshkor qilmaydi). Xotirada (bitta API nusxasi).
 */
@Injectable()
export class RecoveryCodesService {
  private readonly logger = new Logger(RecoveryCodesService.name);
  private readonly pepper: Buffer;
  private readonly ipLimiter: RateLimiter;
  private readonly loginLimiter: RateLimiter;

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
    this.loginLimiter = new RateLimiter(
      positive(config, 'RECOVER_ACCOUNT_LIMIT', 5),
      positive(config, 'RECOVER_ACCOUNT_WINDOW_MS', 60 * MINUTE_MS),
    );
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
    // Ikkala limit ham har urinishda sanaladi (birinchisi rad etsa ikkinchisi sarflanmaydi).
    if (!this.ipLimiter.take(ip) || !this.loginLimiter.take(`${id.kind}:${id.value}`)) {
      throw new HttpException(RECOVER_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = normalizeRecoveryCode(input.code);
    const user = await this.prisma.user.findUnique({
      where: id.kind === 'email' ? { email: id.value } : { username: id.value },
      select: { id: true },
    });
    if (!user || !code) throw new BadRequestException(RECOVER_FAILED_MESSAGE);

    const codeHash = this.hash(code);
    const row = await this.prisma.recoveryCode.findUnique({
      where: { userId_codeHash: { userId: user.id, codeHash } },
    });
    if (!row || row.usedAt) throw new BadRequestException(RECOVER_FAILED_MESSAGE);

    const passwordHash = await argon2.hash(input.newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.recoveryCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (count === 0) throw new BadRequestException(RECOVER_FAILED_MESSAGE);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    });
    this.logger.log(`Parol tiklash kodi bilan tiklandi, sessiyalar yopildi (${user.id})`);
  }
}
