import type { Request, Response } from 'express';

/**
 * Veb uchun refresh token `httpOnly` cookie'da (JS o'qiy olmaydi). Mijoz `X-Suhbat-Cookie: 1`
 * sarlavhasi bilan "cookie rejimi"ni yoqadi; Electron va mobil sarlavhasiz — avvalgidek tanada.
 * CSRF: cookie `SameSite=Strict` + maxsus sarlavha (cross-site so'rov uni preflight'siz qo'ya olmaydi,
 * preflight esa `CORS_ORIGIN` ro'yxati bilan rad etiladi) + cookie faqat `/auth` yo'liga yuboriladi.
 */
export const COOKIE_MODE_HEADER = 'x-suhbat-cookie';
export const REFRESH_COOKIE = 'suhbat_rt';
const PATH = '/auth';

export const isCookieMode = (req: Request): boolean => req.headers[COOKIE_MODE_HEADER] === '1';

export function readRefreshCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === REFRESH_COOKIE) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim()) || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

const baseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: PATH,
});

const ttlMs = () => {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 30) * 86_400_000;
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
};

/**
 * Cookie rejimida refresh token cookie'ga yoziladi va javob tanasidan olib tashlanadi (`''`);
 * boshqa rejimda javob o'zgarmaydi.
 */
export function bindRefreshCookie<T extends { refreshToken: string }>(req: Request, res: Response, body: T): T {
  if (!isCookieMode(req)) return body;
  res.cookie(REFRESH_COOKIE, body.refreshToken, { ...baseOptions(), maxAge: ttlMs() });
  return { ...body, refreshToken: '' };
}

