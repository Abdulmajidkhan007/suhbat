import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Attachment, UploadUrlInput, UploadUrlResponse } from '@suhbat/core';
import { randomUUID } from 'node:crypto';
import type { Attachment as AttachmentRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, UPLOAD_URL_TTL_SECONDS } from './storage.service';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Chatga yozish huquqi chaqiruvchi tomonidan tekshirilgan bo'lishi kerak.
   * Qator `messageId = null` bilan yaratiladi — xabarga `claim` qilinguncha.
   */
  async createUpload(me: string, input: UploadUrlInput): Promise<UploadUrlResponse> {
    const id = randomUUID();
    // Kalitda foydalanuvchi bergan nom yo'q (path traversal / noyob bo'lmaslik).
    const key = `chats/${input.chatId}/${id}`;
    await this.prisma.attachment.create({
      data: {
        id,
        uploaderId: me,
        chatId:     input.chatId,
        kind:       input.kind,
        key,
        name:       input.name,
        mime:       input.mime,
        size:       input.size,
        durationMs: input.kind === 'voice' ? (input.durationMs ?? null) : null,
      },
    });
    const upload = await this.storage.presignPut(key, input.mime, input.size);
    return {
      attachmentId: id,
      uploadUrl:    upload.url,
      headers:      upload.headers,
      expiresAt:    new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /**
   * Xabarga biriktirishdan oldin tekshiruv: yuklovchi — shu foydalanuvchi, chat
   * shu, hali ishlatilmagan va saqlashdagi obyekt e'lon qilingan hajm/turga mos.
   */
  async requireReady(attachmentId: string, me: string, chatId: string): Promise<AttachmentRow> {
    const row = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, uploaderId: me, chatId, messageId: null },
    });
    if (!row) throw new BadRequestException('Biriktirma topilmadi yoki allaqachon ishlatilgan');
    let stored;
    try {
      stored = await this.storage.head(row.key);
    } catch (e) {
      // Saqlash sozlanmagan yoki yetib bo'lmaydi — 500 emas, tushunarli 503.
      this.logger.error(`saqlashga ulanib bo'lmadi: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Fayl saqlash hozir mavjud emas');
    }
    if (!stored) throw new BadRequestException('Fayl hali yuklanmagan');
    if (stored.size !== row.size || stored.mime !== row.mime) {
      await this.storage.delete(row.key);
      throw new BadRequestException('Yuklangan fayl e\'lon qilingan hajm yoki turga mos emas');
    }
    return row;
  }

  async removeObjects(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.storage.delete(k)));
  }

  async toDto(row: AttachmentRow): Promise<Attachment> {
    return {
      id:         row.id,
      kind:       row.kind,
      name:       row.name,
      mime:       row.mime,
      size:       row.size,
      durationMs: row.durationMs,
      url:        await this.storage.presignGet(row.key, {
        name:   row.name,
        mime:   row.mime,
        inline: row.kind !== 'file',
      }),
    };
  }
}
