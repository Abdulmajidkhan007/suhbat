export interface CodeAttemptOptions {
  /** Shuncha noto'g'ri urinishdan keyin identifikator bloklanadi. */
  maxFailures: number;
  /** Blok davomiyligi. */
  blockMs: number;
  /** Bitta identifikatorga kod so'rash orasidagi eng kam vaqt. */
  cooldownMs: number;
}

export const DEFAULT_CODE_ATTEMPT_OPTIONS: CodeAttemptOptions = {
  maxFailures: 5,
  blockMs:     15 * 60_000,
  cooldownMs:  45_000,
};

interface Entry {
  failures:     number;
  blockedUntil: number;
  lastRequest:  number;
  /** Yozuv shu vaqtdan keyin xotiradan tozalanadi. */
  expiresAt:    number;
}

/**
 * Tasdiqlash kodlari (tiklash kodi, kelajakdagi SMS/email kod) uchun cheklov — **identifikator**
 * (email/login/telefon) bo'yicha, IP'dan qat'i nazar: kodni tanlab topishni to'xtatadi.
 * - `maxFailures` marta noto'g'ri kod → `blockMs` ga blok (blokda to'g'ri kod ham o'tmaydi);
 * - kod so'rash — `cooldownMs` da bir marta.
 * Xotirada (bitta API nusxasi), mavjud bo'lmagan identifikator ham sanaladi — hisob
 * borligi oshkor bo'lmaydi. Barcha metodlar qaytarish qiymatida "necha ms kutish kerak"
 * (0 — ruxsat) beradi; vaqt `now` bilan test uchun berilishi mumkin.
 */
export class CodeAttemptGuard {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly opts: CodeAttemptOptions = DEFAULT_CODE_ATTEMPT_OPTIONS) {}

  /** Blokda bo'lsa — qolgan vaqt (ms), aks holda 0. Hisoblamaydi. */
  blockedFor(key: string, now = Date.now()): number {
    const e = this.entries.get(key);
    return e && e.blockedUntil > now ? e.blockedUntil - now : 0;
  }

  /**
   * Noto'g'ri urinishni yozadi. Limitga yetsa blok boshlanadi va hisob nolga tushadi
   * (blokdan keyin yana 5 urinish). Qaytaradi: yangi blok bo'lsa uning davomiyligi, aks holda 0.
   */
  recordFailure(key: string, now = Date.now()): number {
    this.prune(now);
    const e = this.entry(key, now);
    e.failures += 1;
    e.expiresAt = now + this.opts.blockMs;
    if (e.failures >= this.opts.maxFailures) {
      e.failures = 0;
      e.blockedUntil = now + this.opts.blockMs;
      return this.opts.blockMs;
    }
    return 0;
  }

  /** To'g'ri kod: noto'g'ri urinishlar hisobi nolga tushadi (so'rov kutish vaqti saqlanadi). */
  recordSuccess(key: string): void {
    const e = this.entries.get(key);
    if (e) e.failures = 0;
  }

  /**
   * Kod so'rash. Blokda yoki kutish vaqti tugamagan bo'lsa — qolgan ms (so'rov hisoblanmaydi),
   * ruxsat bo'lsa 0 va kutish vaqti qayta boshlanadi.
   */
  takeRequest(key: string, now = Date.now()): number {
    this.prune(now);
    const e = this.entry(key, now);
    const blocked = e.blockedUntil - now;
    if (blocked > 0) return blocked;
    const wait = e.lastRequest + this.opts.cooldownMs - now;
    if (wait > 0) return wait;
    e.lastRequest = now;
    e.expiresAt = Math.max(e.expiresAt, now + this.opts.cooldownMs);
    return 0;
  }

  private entry(key: string, now: number): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = { failures: 0, blockedUntil: 0, lastRequest: Number.NEGATIVE_INFINITY, expiresAt: now + this.opts.blockMs };
      this.entries.set(key, e);
    }
    return e;
  }

  private prune(now: number): void {
    if (this.entries.size <= 10_000) return;
    for (const [k, v] of this.entries) if (v.expiresAt <= now && v.blockedUntil <= now) this.entries.delete(k);
  }
}

/** Kutish vaqtini (ms) foydalanuvchiga ko'rsatiladigan butun soniyaga aylantiradi. */
export const retryAfterSeconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));
