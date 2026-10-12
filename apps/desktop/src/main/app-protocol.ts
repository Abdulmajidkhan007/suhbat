import path from 'node:path';

/** Veb build'i shu maxsus sxema orqali yuklanadi (`file://` emas: origin, CORS va SPA marshrutlari uchun). */
export const APP_SCHEME = 'suhbat';
export const APP_HOST = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * `suhbat://app/<yo'l>` → `webRoot` ichidagi fayl. Ildizdan chiqib ketadigan
 * (`..`) yo'llar `null`. Kengaytmasiz yo'l (SPA marshruti) → `index.html`.
 */
export const resolveAppFile = (webRoot: string, rawUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const root = path.resolve(webRoot);
  const target = path.resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return path.extname(target) === '' ? path.join(root, 'index.html') : target;
};

/**
 * Kontent xavfsizlik siyosati. API manzili build vaqtida ma'lum emas, shuning
 * uchun `connect-src` http(s)/ws(s) ga ochiq; skriptlar esa faqat o'zimizdan.
 * Rasm/ovoz imzolangan saqlash URL'laridan keladi (`img-src`/`media-src`).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' blob: http: https:",
  'connect-src http: https: ws: wss:',
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');
