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
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredObject {
  size: number;
  mime: string;
}

export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/**
 * S3-mos saqlash (lokal — MinIO). Server o'zi fayl oqimini ko'tarmaydi:
 * mijoz imzolangan URL orqali to'g'ridan-to'g'ri saqlashga yuklaydi/yuklab oladi.
 *
 * Ikki xil manzil: `S3_ENDPOINT` — API saqlashga ulanadigan (docker tarmog'i),
 * `S3_PUBLIC_ENDPOINT` — brauzer/mobil ko'radigan manzil (imzolangan URL'lar
 * shu bilan yasaladi). Ko'rsatilmasa ikkalasi bir xil.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
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
      // MinIO `bucket.host` emas, `host/bucket` ko'rinishini kutadi.
      forcePathStyle: true,
    };
    this.internal = new S3Client({ ...base, endpoint });
    this.signer = new S3Client({ ...base, endpoint: publicEndpoint });
  }

  /** Dev qulayligi: bucket yo'q bo'lsa yaratadi. Saqlash ishlamasa API baribir ko'tariladi. */
  async onModuleInit(): Promise<void> {
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

  /** Hajm va tur imzoga kiradi: boshqa hajm/turdagi yuklash saqlash tomonidan rad etiladi. */
  presignPut(key: string, mime: string, size: number): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ContentLength: size }),
      // Content-Type ham imzoga kirsin (Content-Length allaqachon kiradi).
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type']) },
    );
  }

  /** Rasm/ovoz brauzerda ko'rsatiladi (inline); boshqa fayllar — yuklab olinadi (attachment). */
  presignGet(key: string, opts: { name: string; mime: string; inline: boolean }): Promise<string> {
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

  /** Obyekt bo'lmasa `null`. */
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

  /** Xato bo'lsa log yoziladi, chaqiruvchi to'xtamaydi (yetim obyekt — jiddiy emas). */
  async delete(key: string): Promise<void> {
    try {
      await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      this.logger.warn(`obyektni o'chirib bo'lmadi (${key}): ${(e as Error).message}`);
    }
  }
}
