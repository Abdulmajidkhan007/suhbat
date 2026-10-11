import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

/** Saqlash va biriktirma metadata'si. Yuklash endpoint'i — `ChatsModule` da (chat huquqlari kerak). */
@Module({
  providers: [StorageService, MediaService],
  exports:   [MediaService],
})
export class MediaModule {}
