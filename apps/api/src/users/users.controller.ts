import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UpdateNotificationSettingsInputSchema, UpdateProfileInputSchema, UserSearchQuerySchema } from '@suhbat/core';
import type {
  NotificationSettings,
  PublicUser,
  UpdateNotificationSettingsInput,
  UpdateProfileInput,
  User,
  UserSearchQuery,
} from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { toPublicUser, toSelfUser } from '../auth/auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ism bo'yicha — qism (katta-kichik harf farqsiz); email bo'yicha — faqat
   * to'liq mos kelganda (aks holda `a@` bilan boshqalarning emailini terib
   * chiqarish mumkin bo'lardi). Javobda email YO'Q (`PublicUser`). O'zini qaytarmaydi.
   */
  @Get('search')
  async search(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(UserSearchQuerySchema)) query: UserSearchQuery,
  ): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: req.user.sub },
        OR: [
          { displayName: { contains: query.q, mode: 'insensitive' } },
          { email: query.q.toLowerCase() }, // emaillar ro'yxatdan o'tishda kichik harfga o'tkaziladi
        ],
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take:    query.limit,
    });
    return users.map(toPublicUser);
  }

  /** Profilni tahrirlash (ism, bio). Bo'sh `bio` — o'chirish. Avatar yuklash keyinga qoldirilgan (S3). */
  @Patch('me')
  async updateProfile(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(UpdateProfileInputSchema)) body: UpdateProfileInput,
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: req.user.sub },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio || null } : {}),
      },
    });
    return toSelfUser(user);
  }

  @Get('me/notifications')
  async notificationSettings(@Req() req: AuthedRequest): Promise<NotificationSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: req.user.sub },
      select: { notificationPreview: true },
    });
    return { preview: user.notificationPreview };
  }

  @Patch('me/notifications')
  async updateNotificationSettings(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(UpdateNotificationSettingsInputSchema)) body: UpdateNotificationSettingsInput,
  ): Promise<NotificationSettings> {
    const user = await this.prisma.user.update({
      where:  { id: req.user.sub },
      data:   { notificationPreview: body.preview },
      select: { notificationPreview: true },
    });
    return { preview: user.notificationPreview };
  }

  /** Men bloklaganlar. */
  @Get('blocked')
  async blocked(@Req() req: AuthedRequest): Promise<PublicUser[]> {
    const rows = await this.prisma.userBlock.findMany({
      where:   { blockerId: req.user.sub },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toPublicUser(r.blocked));
  }

  /** Bloklash: 1:1 da yozishib bo'lmaydi, bir-biriga push bormaydi. Idempotent. */
  @Post(':id/block')
  @HttpCode(204)
  async block(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    if (id === req.user.sub) throw new BadRequestException('O\'zingizni bloklab bo\'lmaydi');
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) throw new NotFoundException('Foydalanuvchi topilmadi');
    await this.prisma.userBlock.upsert({
      where:  { blockerId_blockedId: { blockerId: req.user.sub, blockedId: id } },
      create: { blockerId: req.user.sub, blockedId: id },
      update: {},
    });
  }

  @Delete(':id/block')
  @HttpCode(204)
  async unblock(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.prisma.userBlock.deleteMany({ where: { blockerId: req.user.sub, blockedId: id } });
  }
}
