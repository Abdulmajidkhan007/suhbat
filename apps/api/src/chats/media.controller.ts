import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { UploadUrlInputSchema } from '@suhbat/core';
import type { UploadUrlInput } from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from '../media/media.service';
import { ChatsService } from './chats.service';

/** Chat huquqlari (`ChatsService`) kerak bo'lgani uchun `ChatsModule` da turadi. */
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly chats: ChatsService,
    private readonly media: MediaService,
  ) {}

  /**
   * 1) shu endpoint → `uploadUrl`; 2) mijoz faylni `PUT` qiladi;
   * 3) xabar yuborishda `attachmentId`. Hajm/tur sxemada va imzoda tekshiriladi.
   */
  @Post('upload-url')
  @HttpCode(200)
  async uploadUrl(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(UploadUrlInputSchema)) body: UploadUrlInput,
  ) {
    await this.chats.assertCanWrite(body.chatId, req.user.sub);
    return this.media.createUpload(req.user.sub, body);
  }
}
