import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isAdminEmail } from '../common/admin-emails';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

export type AdminRequest = AuthedRequest & { adminEmail: string };

/**
 * Faqat email'i `ADMIN_EMAILS` da bo'lgan (bloklanmagan) foydalanuvchi. Boshqa HAMMAGA —
 * tokensiz, yaroqsiz token, oddiy foydalanuvchi — bir xil 404: panel borligi bilinmasin.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new NotFoundException();
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new NotFoundException();
    }
    const user = await this.prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { email: true, blockedAt: true, mustChangePassword: true },
    });
    if (!user || user.blockedAt || user.mustChangePassword || !isAdminEmail(user.email)) throw new NotFoundException();
    req.user = payload;
    req.adminEmail = user.email;
    return true;
  }
}
