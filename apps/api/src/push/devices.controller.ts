import { Body, Controller, Delete, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DeviceTokenSchema, RegisterDeviceInputSchema } from '@suhbat/core';
import type { RegisterDeviceInput } from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

/** Push uchun qurilma tokenlari (FCM registration token). */
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent: token allaqachon bo'lsa yangilanadi. Shu qurilmada boshqa hisob
   * bilan kirilgan bo'lsa token joriy foydalanuvchiga o'tadi (oldingisiga push bormaydi).
   */
  @Post()
  @HttpCode(204)
  async register(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(RegisterDeviceInputSchema)) body: RegisterDeviceInput,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where:  { token: body.token },
      create: { token: body.token, platform: body.platform, userId: req.user.sub },
      update: { platform: body.platform, userId: req.user.sub },
    });
  }

  /** Faqat o'z tokenini o'chiradi; topilmasa ham 204 (idempotent). */
  @Delete(':token')
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param('token', new ZodValidationPipe(DeviceTokenSchema)) token: string,
  ): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId: req.user.sub } });
  }
}
