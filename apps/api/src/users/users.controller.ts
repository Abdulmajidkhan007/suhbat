import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserSearchQuerySchema } from '@suhbat/core';
import type { User, UserSearchQuery } from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { toPublicUser } from '../auth/auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Ism yoki email bo'yicha (katta-kichik harf farqsiz), o'zini qaytarmaydi. */
  @Get('search')
  async search(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(UserSearchQuerySchema)) query: UserSearchQuery,
  ): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: req.user.sub },
        OR: [
          { displayName: { contains: query.q, mode: 'insensitive' } },
          { email:       { contains: query.q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take:    query.limit,
    });
    return users.map(toPublicUser);
  }
}
