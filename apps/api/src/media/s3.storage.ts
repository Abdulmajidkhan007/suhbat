import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DOWNLOAD_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS } from './storage.driver';
import type { GetOptions, PresignedPut, StorageDriver, StoredObject } from './storage.driver';

/**
 * S3-mos saqlash (MinIO, Cloudflare R2, ...). `S3_ENDPOINT` berilganda ishlatiladi. Server o'zi fayl oqimini ko'tarmaydi:
 * mijoz imzolangan URL orqali to'g'ridan-to'g'ri saqlashga yuklaydi/yuklab oladi.
 *
 * Ikki xil manzil: `S3_ENDPOINT` — API saqlashga ulanadigan (docker tarmog'i),
 * `S3_PUBLIC_ENDPOINT` — brauzer/mobil ko'radigan manzil (imzolangan URL'lar
 * shu bilan yasaladi). Ko'rsatilmasa ikkalasi bir xil.
 */
export class S3StorageDriver implements StorageDriver {
  readonly kind = 's3';
  private readonly logger = new Logger('S3Storage');
  private readonly bucket: string;
  private readonly internal: S3Client;
  private readonly signer: S3Client;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT') ?? endpoint;
    this.bucket = config.get<string>('S3_BUCKET') ?? 'suhbat';
    const base = {
      region:         config.get<string>('S3_REGION') ?? 'us-east-1',
      credentials:    {
        accessKeyId:     config.get<string>('S3_ACCESS_KEY') ?? 'suhbat',
        secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? 'suhbat-minio-secret',
      },
      // MinIO va R2 `host/bucket` ko'rinishini kutadi (standart). `bucket.host`
      // talab qiladigan xizmat uchun S3_FORCE_PATH_STYLE=false.
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
    };
    this.internal = new S3Client({ ...base, endpoint });
    this.signer = new S3Client({ ...base, endpoint: publicEndpoint });
  }

  /** Dev qulayligi: bucket yo'q bo'lsa yaratadi. Saqlash ishlamasa API baribir ko'tariladi. */
  async init(): Promise<void> {
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.internal.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`bucket "${this.bucket}" yaratildi`);
      } catch (e) {
        this.logger.warn(`Saqlash (S3) mavjud emas — media ishlamaydi: ${(e as Error).message}`);
      }
    }
  }

  async presignPut(key: string, mime: string, size: number): Promise<PresignedPut> {
    const url = await getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ContentLength: size }),
      // Content-Type ham imzoga kirsin (Content-Length allaqachon kiradi).
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type']) },
    );
    return { url, headers: { 'Content-Type': mime } };
  }

  presignGet(key: string, opts: GetOptions): Promise<string> {
    const encoded = encodeURIComponent(opts.name);
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket:                     this.bucket,
        Key:                        key,
        ResponseContentType:        opts.mime,
        ResponseContentDisposition: `${opts.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        size: res.ContentLength ?? -1,
        mime: (res.ContentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '',
      };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      this.logger.warn(`obyektni o'chirib bo'lmadi (${key}): ${(e as Error).message}`);
    }
  }
}
