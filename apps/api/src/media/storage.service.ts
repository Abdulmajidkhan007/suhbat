import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local.storage';
import { S3StorageDriver } from './s3.storage';
import type { GetOptions, PresignedPut, StorageDriver, StoredObject } from './storage.driver';

export { DOWNLOAD_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS } from './storage.driver';
export type { StoredObject } from './storage.driver';

/**
 * Drayverni tanlaydi: `S3_ENDPOINT` berilgan bo'lsa — S3 (MinIO, R2), aks holda
 * `local` (API diski / Railway Volume). Qolgan kod faqat shu servisni ko'radi.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    this.driver = config.get<string>('S3_ENDPOINT') ? new S3StorageDriver(config) : new LocalStorageDriver(config);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`media saqlash: ${this.driver.kind}`);
    await this.driver.init();
  }

  /** `local` bo'lsa uning o'zi (blob endpoint uchun), aks holda `null`. */
  get local(): LocalStorageDriver | null {
    return this.driver instanceof LocalStorageDriver ? this.driver : null;
  }

  presignPut(key: string, mime: string, size: number): Promise<PresignedPut> {
    return this.driver.presignPut(key, mime, size);
  }

  presignGet(key: string, opts: GetOptions): Promise<string> {
    return this.driver.presignGet(key, opts);
  }

  head(key: string): Promise<StoredObject | null> {
    return this.driver.head(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }
}
