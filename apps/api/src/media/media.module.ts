import { Module } from '@nestjs/common';
import { MediaBlobController } from './media-blob.controller';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

/** Saqlash va biriktirma metadata'si. `upload-url` — `ChatsModule` da (chat huquqlari kerak); `local` drayverning `/media/blob` — shu yerda. */
@Module({
  controllers: [MediaBlobController],
  providers: [StorageService, MediaService, MediaCleanupService],
  exports:   [MediaService],
})
export class MediaModule {}
