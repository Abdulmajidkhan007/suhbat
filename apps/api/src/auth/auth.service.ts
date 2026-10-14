import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput, TokenPair, User } from '@suhbat/core';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import type { User as UserRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  /** UNIX soniya (jsonwebtoken qo'shadi). */
  exp?: number;
}

/** Boshqalarga ko'rsatiladigan shakl — email YO'Q. */
export const toPublicUser = (u: UserRow): PublicUser => ({
  id:          u.id,
  displayName: u.displayName,
  photoUrl:    u.photoUrl,
  bio:         u.bio,
  createdAt:   u.createdAt.toISOString(),
});

/** Faqat foydalanuvchining o'zi uchun (email bilan). */
export const toSelfUser = (u: UserRow): User => ({ ...toPublicUser(u), email: u.email });

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config?: ConfigService,
  ) {
    const days = Number(config?.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    if (!Number.isFinite(days) || days <= 0) throw new Error('REFRESH_TOKEN_TTL_DAYS musbat son bo\'lishi kerak');
    this.refreshTtlMs = days * DAY_MS;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: input.email, passwordHash, displayName: input.displayName },
      });
      return this.issue(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu email bilan hisob mavjud');
      }
      throw e;
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Email yoki parol noto\'g\'ri');
    }
    return this.issue(user);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toSelfUser(user);
  }

  /**
   * Refresh token rotatsiyasi: eski token bekor qilinadi, o'sha oiladan yangi
   * juftlik beriladi. Bekor qilingan token qayta kelsa (o'g'irlangan bo'lishi
   * mumkin) — butun oila bekor qilinadi va 401.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = new Date();
    const row = await this.prisma.refreshToken.findUnique({
      where:   { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException();
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId, now);
      throw new UnauthorizedException();
    }
    if (row.expiresAt <= now) throw new UnauthorizedException();

    // Shartli yangilash: parallel so'rovlardan faqat bittasi tokenni "oladi".
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data:  { revokedAt: now },
    });
    if (count === 0) {
      await this.revokeFamily(row.familyId, now);
      throw new UnauthorizedException();
    }
    const { accessToken, refreshToken: next } = await this.issue(row.user, row.familyId);
    return { accessToken, refreshToken: next };
  }

  /**
   * Shu qurilma sessiyasini (token oilasini) yopadi va push tokenini o'chiradi
   * (faqat shu foydalanuvchiniki bo'lsa). Noma'lum token — jim o'tadi.
   */
  async logout(refreshToken: string, deviceToken?: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!row) return;
    await this.revokeFamily(row.familyId, new Date());
    if (deviceToken) await this.prisma.deviceToken.deleteMany({ where: { token: deviceToken, userId: row.userId } });
  }

  private async revokeFamily(familyId: string, now: Date) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data:  { revokedAt: now },
    });
  }

  private async issue(user: UserRow, familyId: string = randomUUID()): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id };
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId:    user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      user:        toSelfUser(user),
    };
  }
}
