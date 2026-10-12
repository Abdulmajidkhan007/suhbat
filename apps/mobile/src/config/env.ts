import { Platform } from 'react-native';

// Babel plagini (`babel/inline-api-url.js`) build vaqtida satrga almashtiradi.
declare const process: { env: { SUHBAT_API_URL?: string } };

const DEV_PORT = 4000;

/** Oxiridagi `/` olib tashlanadi — `@suhbat/client` shuni kutadi. */
export const normalizeApiUrl = (url: string): string => url.trim().replace(/\/+$/, '');

/**
 * Standart (dev) manzil: Android emulyatorda host mashina `10.0.2.2`,
 * iOS simulyatorda `localhost`. Haqiqiy qurilma yoki server uchun
 * `SUHBAT_API_URL=https://api.example.uz` bilan build qilinadi.
 */
export const defaultApiUrl = (os: typeof Platform.OS): string =>
  os === 'android' ? `http://10.0.2.2:${DEV_PORT}` : `http://localhost:${DEV_PORT}`;

export const API_URL = normalizeApiUrl(process.env.SUHBAT_API_URL ?? defaultApiUrl(Platform.OS));
