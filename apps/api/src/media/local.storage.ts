import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { link, mkdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DOWNLOAD_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS } from './storage.driver';
import type { GetOptions, PresignedPut, StorageDriver, StoredObject } from './storage.driver';

/** Imzolangan yuklash (`PUT`) havolasi parametrlari. */
export interface PutTicket {
  key:  string;
  mime: string;
  size: number;
  exp:  number;
}

/** Imzolangan yuklab olish (`GET`) havolasi parametrlari. */
export interface GetTicket {
  key:    string;
  mime:   string;
  name:   string;
  inline: boolean;
  exp:    number;
}

export class UploadRejected extends Error {
  constructor(message: string, readonly status: 400 | 409 | 413) {
    super(message);
  }
}

/** Faqat biz yasaydigan kalitlar (`chats/<uuid>/<uuid>`): `..`, mutlaq yo'l, nuqta yo'q. */
const KEY_RE = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i;
const META_SUFFIX = '.meta.json';

/**
 * Fayllar API diskida (`MEDIA_DIR`; Railway'da Volume). Mijoz API'ning o'ziga
 * yuklaydi/yuklab oladi — `/media/blob?...&sig=` (HMAC, qisqa muddatli), xuddi
 * S3 imzolangan URL'idek: havola faqat chat a'zosiga beriladi, JWT kerak emas
 * (`<img src>` va `<audio>` sarlavha qo'sha olmaydi).
 *
 * Har obyekt yonida `<kalit>.meta.json` (`{ mime, size }`). Yuklash avval
 * vaqtinchalik faylga yoziladi va faqat hajm aniq mos kelsa `link` bilan
 * joyiga qo'yiladi — mavjud faylni qayta yozib bo'lmaydi.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = 'local';
  private readonly logger = new Logger('LocalStorage');
  readonly root: string;
  private readonly secret: Buffer;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(LocalStorageDriver.dirFrom(config));
    const seed = config.get<string>('MEDIA_SIGNING_SECRET') || config.getOrThrow<string>('JWT_SECRET');
    // JWT kaliti bilan aynan bir xil kalit ishlatilmasin — undan alohida kalit hosil qilinadi.
    this.secret = createHmac('sha256', seed).update('suhbat-media-v1').digest();
  }

  /** `MEDIA_DIR` → Railway Volume (`RAILWAY_VOLUME_MOUNT_PATH/media`) → `./.data/media`. */
  static dirFrom(config: ConfigService): string {
    const explicit = config.get<string>('MEDIA_DIR');
    if (explicit) return explicit;
    const volume = config.get<string>('RAILWAY_VOLUME_MOUNT_PATH');
    if (volume) return join(volume, 'media');
    return join(process.cwd(), '.data', 'media');
  }

  async init(): Promise<void> {
    try {
      await mkdir(join(this.root, '.tmp'), { recursive: true });
      const probe = join(this.root, '.tmp', `probe-${randomUUID()}`);
      await writeFile(probe, '');
      await unlink(probe);
      this.logger.log(`media fayllari: ${this.root}`);
    } catch (e) {
      this.logger.warn(`media papkasiga yozib bo'lmaydi (${this.root}) — media ishlamaydi: ${(e as Error).message}`);
      return;
    }
    if (this.config.get('RAILWAY_ENVIRONMENT') && !this.config.get('RAILWAY_VOLUME_MOUNT_PATH') && !this.config.get('MEDIA_DIR')) {
      this.logger.warn('Railway Volume ulanmagan: fayllar har deploy\'da YO\'QOLADI (QADAMLAR.md — Volume qo\'shing)');
    }
  }

  /** Imzolangan URL'lar shu manzil bilan yasaladi (mijoz ko'radigan API manzili). */
  private get baseUrl(): string {
    const explicit = this.config.get<string>('PUBLIC_API_URL');
    if (explicit) return explicit.replace(/\/+$/, '');
    const railway = this.config.get<string>('RAILWAY_PUBLIC_DOMAIN');
    if (railway) return `https://${railway}`;
    return `http://localhost:${this.config.get<string>('PORT') ?? '4000'}`;
  }

  private sign(parts: (string | number)[]): string {
    return createHmac('sha256', this.secret).update(JSON.stringify(parts)).digest('base64url');
  }

  private verify(parts: (string | number)[], sig: string, exp: number): boolean {
    if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(parts));
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private static expIn(seconds: number): number {
    return Math.floor(Date.now() / 1000) + seconds;
  }

  async presignPut(key: string, mime: string, size: number): Promise<PresignedPut> {
    const exp = LocalStorageDriver.expIn(UPLOAD_URL_TTL_SECONDS);
    const q = new URLSearchParams({
      key, mime, size: String(size), exp: String(exp), sig: this.sign(['put', key, mime, size, exp]),
    });
    // Tur imzoda; tana xom bayt sifatida keladi (JSON fayl body-parser'ga tushmasin).
    return { url: `${this.baseUrl}/media/blob?${q}`, headers: { 'Content-Type': 'application/octet-stream' } };
  }

  async presignGet(key: string, opts: GetOptions): Promise<string> {
    const exp = LocalStorageDriver.expIn(DOWNLOAD_URL_TTL_SECONDS);
    const disp = opts.inline ? 'inline' : 'attachment';
    const q = new URLSearchParams({
      key, mime: opts.mime, name: opts.name, disp, exp: String(exp),
      sig: this.sign(['get', key, opts.mime, opts.name, disp, exp]),
    });
    return `${this.baseUrl}/media/blob?${q}`;
  }

  /** Imzo noto'g'ri yoki muddati o'tgan bo'lsa `null`. */
  verifyPut(q: Record<string, string | undefined>): PutTicket | null {
    const { key = '', mime = '', sig = '' } = q;
    const size = Number(q.size);
    const exp = Number(q.exp);
    if (!Number.isInteger(size) || size < 1) return null;
    return this.verify(['put', key, mime, size, exp], sig, exp) ? { key, mime, size, exp } : null;
  }

  verifyGet(q: Record<string, string | undefined>): GetTicket | null {
    const { key = '', mime = '', name = '', disp = '', sig = '' } = q;
    const exp = Number(q.exp);
    if (disp !== 'inline' && disp !== 'attachment') return null;
    return this.verify(['get', key, mime, name, disp, exp], sig, exp)
      ? { key, mime, name, inline: disp === 'inline', exp }
      : null;
  }

  /** Kalitni papka ichidagi yo'lga aylantiradi; tashqariga chiqsa — xato. */
  pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!KEY_RE.test(key) || !path.startsWith(this.root + sep)) throw new Error(`noto'g'ri kalit: ${key}`);
    return path;
  }

  /**
   * Oqimni vaqtinchalik faylga yozadi: `size` dan oshsa darhol to'xtatadi, kam
   * bo'lsa rad etadi. Muvaffaqiyatda fayl joyiga qo'yiladi (mavjud bo'lsa — 409).
   */
  async write(ticket: PutTicket, body: Readable): Promise<void> {
    const target = this.pathOf(ticket.key);
    const tmp = join(this.root, '.tmp', randomUUID());
    let received = 0;
    const limiter = async function* (source: Readable) {
      for await (const chunk of source) {
        received += (chunk as Buffer).length;
        if (received > ticket.size) throw new UploadRejected('Fayl e\'lon qilingan hajmdan katta', 413);
        yield chunk as Buffer;
      }
    };
    try {
      await mkdir(dirname(tmp), { recursive: true });
      await pipeline(body, limiter, createWriteStream(tmp, { flags: 'wx' }));
      if (received !== ticket.size) throw new UploadRejected('Fayl e\'lon qilingan hajmga mos emas', 400);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(`${target}${META_SUFFIX}`, JSON.stringify({ mime: ticket.mime, size: ticket.size }));
      try {
        await link(tmp, target);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new UploadRejected('Fayl allaqachon yuklangan', 409);
        throw e;
      }
    } finally {
      await rm(tmp, { force: true });
    }
  }

  async head(key: string): Promise<StoredObject | null> {
    const path = this.pathOf(key);
    try {
      const [st, meta] = await Promise.all([stat(path), readFile(`${path}${META_SUFFIX}`, 'utf8')]);
      const { mime } = JSON.parse(meta) as { mime: string };
      return { size: st.size, mime };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const path = this.pathOf(key);
      await Promise.all([rm(path, { force: true }), rm(`${path}${META_SUFFIX}`, { force: true })]);
    } catch (e) {
      this.logger.warn(`faylni o'chirib bo'lmadi (${key}): ${(e as Error).message}`);
    }
  }
}
