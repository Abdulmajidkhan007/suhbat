import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UploadRejected } from './local.storage';
import type { LocalStorageDriver } from './local.storage';
import { StorageService } from './storage.service';

type Q = Record<string, string | undefined>;

/**
 * `local` drayver uchun yuklash/yuklab olish. JWT yo'q — ruxsat imzoning
 * o'zida (havolani faqat chat a'zosi oladi, muddati qisqa). S3 bo'lsa — 404.
 */
@Controller('media/blob')
export class MediaBlobController {
  constructor(private readonly storage: StorageService) {}

  private get local(): LocalStorageDriver {
    const local = this.storage.local;
    if (!local) throw new NotFoundException();
    return local;
  }

  @Put()
  @HttpCode(200)
  async put(@Query() q: Q, @Req() req: Request): Promise<{ ok: true }> {
    const local = this.local;
    const ticket = local.verifyPut(q);
    if (!ticket) throw new ForbiddenException('Havola noto\'g\'ri yoki muddati o\'tgan');
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > ticket.size) {
      throw new HttpException('Fayl e\'lon qilingan hajmdan katta', 413);
    }
    try {
      await local.write(ticket, req);
    } catch (e) {
      if (e instanceof UploadRejected) throw new HttpException(e.message, e.status);
      throw e;
    }
    return { ok: true };
  }

  @Get()
  @SkipThrottle({ default: true, auth: true })
  async get(@Query() q: Q, @Res() res: Response): Promise<void> {
    const local = this.local;
    const ticket = local.verifyGet(q);
    if (!ticket) throw new ForbiddenException('Havola noto\'g\'ri yoki muddati o\'tgan');
    if (!(await local.head(ticket.key))) throw new NotFoundException();
    const disposition = `${ticket.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(ticket.name)}`;
    await new Promise<void>((resolve, reject) => {
      res.sendFile(
        local.pathOf(ticket.key),
        {
          cacheControl: false,
          headers: {
            'Content-Type':            ticket.mime,
            'Content-Disposition':     disposition,
            'Cache-Control':           'private, max-age=3600',
            'X-Content-Type-Options':  'nosniff',
            // API domenida ochilgan fayl skript ishga tushira olmasin.
            'Content-Security-Policy': "default-src 'none'; media-src 'self'; img-src 'self'; sandbox",
            // Veb boshqa domenda: <img>/<audio> uchun.
            'Cross-Origin-Resource-Policy': 'cross-origin',
          },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    }).catch((err: NodeJS.ErrnoException & { status?: number }) => {
      // Mijoz uzilgan bo'lsa javob allaqachon ketgan; aks holda Nest xatoga aylantiradi.
      if (res.headersSent) return;
      throw err.status === 404 ? new NotFoundException() : err;
    });
  }
}
