/**
 * Har xil vaqt ko'rinishini millisekundga keltiradi:
 * raqam (ms), `Date`, ISO satr, Firestore `Timestamp` (`toMillis()` yoki
 * `{ seconds, nanoseconds }`). Tanib bo'lmasa — `null` (masalan, Firestore
 * `serverTimestamp()` hali server tomonidan to'ldirilmagan bo'lsa).
 */
export const toMillis = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value && typeof value === 'object') {
    const v = value as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown };
    if (typeof v.toMillis === 'function') return toMillis((v.toMillis as () => unknown)());
    if (typeof v.seconds === 'number') {
      const nanos = typeof v.nanoseconds === 'number' ? v.nanoseconds : 0;
      return v.seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  return null;
};
