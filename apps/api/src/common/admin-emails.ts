/**
 * `ADMIN_EMAILS` — vergul bilan ajratilgan email'lar (Railway Variables). Har chaqiriqda o'qiladi,
 * shuning uchun qiymat o'zgarsa (qayta ishga tushirishdan keyin) darhol ta'sir qiladi va testlarda
 * `process.env` orqali sozlanadi. Bo'sh/yo'q bo'lsa — hech kim admin emas.
 */
export const adminEmails = (): Set<string> =>
  new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );

export const isAdminEmail = (email: string): boolean => adminEmails().has(email.trim().toLowerCase());
