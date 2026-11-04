import { normalizeMime } from '@suhbat/core';

/** Fayl boshidan shuncha bayt o'qiladi (barcha imzolar va matn tekshiruvi uchun yetarli). */
export const SNIFF_BYTES = 4096;

/**
 * Fayl "oilasi" — birinchi baytlardan aniqlanadi (`Content-Type` va nomga ishonilmaydi).
 * `text` — imzosi yo'q, lekin ikkilik/markup emas; `json` — `text` ning `{`/`[` bilan boshlanadigan qismi.
 */
export type FileFamily =
  | 'jpeg' | 'png' | 'gif' | 'webp'
  | 'pdf' | 'zip' | 'ole'
  | 'ogg' | 'webm' | 'mp4' | 'qt' | 'mp3' | 'aac' | 'wav'
  | 'json' | 'text';

const startsWith = (b: Buffer, sig: readonly number[], at = 0): boolean =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

const ascii = (b: Buffer, from: number, to: number): string => b.toString('latin1', from, to);

/** Matn: NUL va boshqaruv baytlari yo'q, markup (`<...`, `#!`) bilan boshlanmaydi. */
const sniffText = (b: Buffer): FileFamily | null => {
  let i = startsWith(b, [0xef, 0xbb, 0xbf]) ? 3 : 0; // UTF-8 BOM
  for (let k = i; k < b.length; k++) {
    const c = b[k]!;
    if (c === 0 || (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return null;
  }
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  if (i >= b.length) return 'text'; // bo'sh joy — zararsiz
  const first = b[i]!;
  if (first === 0x3c /* < */ || (first === 0x23 && b[i + 1] === 0x21) /* #! */) return null;
  return first === 0x7b || first === 0x5b ? 'json' : 'text';
};

/** Boshlang'ich baytlar bo'yicha oila; ruxsat etilgan ro'yxatdagi hech narsaga o'xshamasa `null`. */
export const sniffFamily = (b: Buffer): FileFamily | null => {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(b, 0, 4) === 'RIFF' && b.length >= 12) {
    const form = ascii(b, 8, 12);
    if (form === 'WEBP') return 'webp';
    if (form === 'WAVE') return 'wav';
    return null;
  }
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return 'zip';
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  if (ascii(b, 0, 4) === 'OggS') return 'ogg';
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') return ascii(b, 8, 12) === 'qt  ' ? 'qt' : 'mp4';
  if (ascii(b, 0, 3) === 'ID3') return 'mp3';
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) {
    // MPEG kadr sinxronlari: qatlam 00 — ADTS (AAC), qolgani — MP3.
    return ((b[1]! >> 1) & 0x03) === 0 ? 'aac' : 'mp3';
  }
  return sniffText(b);
};

/** E'lon qilingan `Content-Type` uchun ichki oilalardan qaysilari mos keladi. */
const FAMILIES_BY_MIME: Record<string, readonly FileFamily[]> = {
  'image/jpeg': ['jpeg'],
  'image/png':  ['png'],
  'image/gif':  ['gif'],
  'image/webp': ['webp'],
  'audio/webm': ['webm'],
  'audio/ogg':  ['ogg'],
  'audio/mp4':  ['mp4'],
  'audio/mpeg': ['mp3'],
  'audio/wav':  ['wav'],
  'audio/aac':  ['aac'],
  'video/mp4':  ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['qt', 'mp4'],
  'application/pdf': ['pdf'],
  'application/zip': ['zip'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['zip'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['zip'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['zip'],
  'application/msword': ['ole'],
  'application/vnd.ms-excel': ['ole'],
  'application/vnd.ms-powerpoint': ['ole'],
  'application/json': ['json'],
  'text/plain': ['text', 'json'],
  'text/csv':   ['text', 'json'],
};

/** Kengaytma → mos oilalar. Ro'yxatda yo'q kengaytma faqat matn oilasida (`.md`, `.log`, ...) qabul qilinadi. */
const FAMILIES_BY_EXT: Record<string, readonly FileFamily[]> = {
  jpg: ['jpeg'], jpeg: ['jpeg'], jpe: ['jpeg'], jfif: ['jpeg'],
  png: ['png'], gif: ['gif'], webp: ['webp'],
  pdf: ['pdf'],
  zip: ['zip'], docx: ['zip'], xlsx: ['zip'], pptx: ['zip'],
  doc: ['ole'], xls: ['ole'], ppt: ['ole'],
  ogg: ['ogg'], oga: ['ogg'], opus: ['ogg'],
  webm: ['webm'], weba: ['webm'],
  mp4: ['mp4'], m4a: ['mp4'], m4v: ['mp4'], mov: ['qt', 'mp4'],
  mp3: ['mp3'], mpga: ['mp3'], mpeg: ['mp3'],
  aac: ['aac'],
  wav: ['wav'], wave: ['wav'],
  json: ['json'],
  txt: ['text', 'json'], csv: ['text', 'json'], tsv: ['text'], md: ['text'], log: ['text'],
};

/** Hech qachon ruxsat etilmaydi (mazmuni qanday bo'lmasin): brauzer/OS bajaradigan yoki render qiladigan turlar. */
const BLOCKED_EXT = new Set([
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'svgz', 'xml', 'xsl', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'php', 'phtml', 'asp', 'aspx', 'jsp',
  'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'sh', 'bash', 'ps1', 'vbs', 'jar', 'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm',
  'swf', 'hta', 'lnk', 'url',
]);

const extOf = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).trim().toLowerCase() : '';
};

/**
 * Yuklangan fayl e'lon qilingan turga haqiqatan mosligini tekshiradi: tur birinchi baytlardan
 * aniqlanadi va (1) `mime` ga, (2) fayl nomi kengaytmasiga mos kelishi shart. Mos bo'lmasa —
 * foydalanuvchiga ko'rsatiladigan sabab; mos bo'lsa `null`. HTML/SVG/skript hech qachon o'tmaydi.
 */
export const validateUploadContent = (declaredMime: string, name: string, head: Buffer): string | null => {
  const allowed = FAMILIES_BY_MIME[normalizeMime(declaredMime)];
  if (!allowed) return 'Bu fayl turi ruxsat etilmagan';
  const ext = extOf(name);
  if (BLOCKED_EXT.has(ext)) return 'Bu fayl turi ruxsat etilmagan';
  const family = sniffFamily(head);
  if (!family || !allowed.includes(family)) return 'Fayl mazmuni e\'lon qilingan turga mos emas';
  if (ext) {
    const byExt = FAMILIES_BY_EXT[ext];
    const ok = byExt ? byExt.includes(family) : family === 'text';
    if (!ok) return 'Fayl nomi (kengaytmasi) mazmuniga mos emas';
  }
  return null;
};
