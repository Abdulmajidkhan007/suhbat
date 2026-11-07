import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.service';

export type AuthedRequest = Request & { user: JwtPayload };

const ALLOW_PENDING_PASSWORD = 'suhbat:allow-pending-password';
/** `mustChangePassword` bo'lgan foydalanuvchi ham chaqira oladigan endpoint (parol almashtirish, `/auth/me`). */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export const PASSWORD_CHANGE_REQUIRED_MESSAGE = 'Avval yangi parol o\'rnating';

/**
 * Access token imzosini tekshiradi va foydalanuvchi holatini bazadan o'qiydi (bitta PK so'rov):
 * o'chirilgan yoki bloklangan hisob — 401 (token muddati tugashini kutmaydi); vaqtinchalik
 * parol almashtirilmagan bo'lsa — faqat `@AllowPendingPassword()` endpointlar, qolgani 403.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { blockedAt: true, mustChangePassword: true },
    });
    if (!user || user.blockedAt) throw new UnauthorizedException();
    if (user.mustChangePassword && this.reflector.get<boolean>(ALLOW_PENDING_PASSWORD, context.getHandler()) !== true) {
      throw new ForbiddenException(PASSWORD_CHANGE_REQUIRED_MESSAGE);
    }
    return true;
  }
}
