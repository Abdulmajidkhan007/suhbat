/**
 * Oddiy "fixed window" cheklovchi (bitta API nusxasi xotirasida) — WebSocket
 * voqealari uchun; REST'da `@nestjs/throttler` ishlatiladi.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** `true` — ruxsat (hisoblandi), `false` — oynadagi limit tugagan. */
  take(key: string, now = Date.now()): boolean {
    if (this.hits.size > 10_000) this.prune(now);
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (cur.count >= this.limit) return false;
    cur.count += 1;
    return true;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
