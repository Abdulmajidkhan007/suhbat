import { z } from 'zod';

// Username qoidalari (Telegram'ga o'xshash): 5–32 belgi, faqat `a-z`, `0-9`, `_`,
// harf bilan boshlanadi, `_` bilan tugamaydi, ketma-ket `__` yo'q.
// Katta-kichik harf farqsiz: bazada doim kichik harfda saqlanadi.
export const USERNAME_MIN = 5;
export const USERNAME_MAX = 32;

/** Band qilib bo'lmaydigan nomlar (aniq moslik) — xizmat va soxta "rasmiy" hisoblarga qarshi. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'admins', 'root', 'system', 'support', 'help', 'helpdesk',
  'moderator', 'moderators', 'official', 'security', 'staff', 'team', 'service',
  'suhbat', 'suhbatuz', 'suhbat_uz', 'suhbatapp', 'suhbat_app', 'suhbatbot',
  'api', 'www', 'mail', 'email', 'info', 'noreply', 'no_reply', 'postmaster', 'abuse',
  'login', 'logout', 'register', 'signup', 'settings', 'profile', 'account', 'password',
  'null', 'undefined', 'anonymous', 'everyone', 'channel', 'group', 'user', 'users',
]);

/** Kiritilgan qiymatni solishtirish shakliga keltiradi: bo'sh joy, boshidagi `@`, katta harf. */
export const normalizeUsername = (raw: string): string => raw.trim().replace(/^@/, '').toLowerCase();

/**
 * Username'dagi muammo (o'zbekcha) yoki `null` — to'g'ri. Kiritish allaqachon
 * `normalizeUsername` dan o'tgan deb hisoblanadi.
 */
export const usernameProblem = (u: string): string | null => {
  if (u.length < USERNAME_MIN) return `Username kamida ${USERNAME_MIN} belgi bo'lsin`;
  if (u.length > USERNAME_MAX) return `Username ko'pi bilan ${USERNAME_MAX} belgi bo'lsin`;
  if (!/^[a-z0-9_]+$/.test(u)) return 'Faqat lotin harflari (a–z), raqamlar va _ mumkin';
  if (!/^[a-z]/.test(u)) return 'Username harf bilan boshlansin';
  if (u.endsWith('_')) return 'Username _ bilan tugamasin';
  if (u.includes('__')) return 'Ketma-ket ikki _ mumkin emas';
  if (RESERVED_USERNAMES.has(u) || u.startsWith('suhbat')) return 'Bu username band qilingan';
  return null;
};

/** Kirishni normallashtiradi (`@Ali_01` → `ali_01`) va qoidalarni tekshiradi. */
export const UsernameSchema = z
  .string()
  .max(USERNAME_MAX + 8)
  .transform(normalizeUsername)
  .superRefine((u, ctx) => {
    const problem = usernameProblem(u);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export type LoginIdentifier = { kind: 'email'; value: string } | { kind: 'username'; value: string };

/** "Email yoki username" maydoni: `@` ichida bo'lsa email, aks holda username (boshidagi `@` tashlanadi). */
export const parseLoginIdentifier = (raw: string): LoginIdentifier => {
  const v = raw.trim().toLowerCase();
  if (v.startsWith('@')) return { kind: 'username', value: v.slice(1) };
  return v.includes('@') ? { kind: 'email', value: v } : { kind: 'username', value: v };
};
