export interface StoredObject {
  size: number;
  mime: string;
}

/** Mijoz faylni shu manzilga shu sarlavhalar bilan `PUT` qiladi. */
export interface PresignedPut {
  url:     string;
  headers: Record<string, string>;
}

export interface GetOptions {
  name:   string;
  mime:   string;
  inline: boolean;
}

export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/**
 * Fayl saqlash drayveri. Ikkalasida ham bir xil oqim: server qisqa muddatli
 * imzolangan URL beradi, mijoz o'sha URL bilan yuklaydi/yuklab oladi.
 * - `s3` — S3-mos xizmat (MinIO, R2): URL saqlashning o'ziga.
 * - `local` — API diskida (Railway Volume): URL API'ning `/media/blob` ga.
 */
export interface StorageDriver {
  readonly kind: 'local' | 's3';
  /** Ishga tushishda; xato bo'lsa API baribir ko'tariladi (log). */
  init(): Promise<void>;
  /** Hajm va tur imzoga kiradi: boshqasi saqlash tomonidan rad etiladi. */
  presignPut(key: string, mime: string, size: number): Promise<PresignedPut>;
  /** Rasm/ovoz — `inline`, fayl — `attachment`. */
  presignGet(key: string, opts: GetOptions): Promise<string>;
  /** Obyekt bo'lmasa `null`; saqlashga ulanib bo'lmasa — xato. */
  head(key: string): Promise<StoredObject | null>;
  /** Xato bo'lsa log yoziladi, chaqiruvchi to'xtamaydi. */
  delete(key: string): Promise<void>;
}
