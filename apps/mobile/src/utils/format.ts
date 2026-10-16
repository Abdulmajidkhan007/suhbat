import type { ChatSummary, Message, MessageReply } from '@suhbat/core';
import { t } from '../i18n';
import { AVATAR_COLORS } from '../theme/colors';

const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'] as const;
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'] as const;
/** `Date.getDay()` tartibida (yakshanbadan). */
const WEEKDAYS_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'] as const;

const DAY_MS = 86_400_000;

const parse = (iso: string): Date | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Bugundan necha kun oldin (0 — bugun, 1 — kecha). */
const daysAgo = (d: Date, now: Date): number => Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);

/** `14:05` — mahalliy vaqt, 24 soatlik. */
export const formatTime = (iso: string): string => {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
};

/** `05.01.2026` */
export const formatDate = (d: Date): string => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

/** Ro'yxatdagi vaqt: bugun — `14:05`, kecha — "Kecha", shu hafta — "Du", shu yil — "12 okt", aks holda `05.01.25`. */
export const formatChatTime = (iso: string, now: Date = new Date()): string => {
  const d = parse(iso);
  if (!d) return '';
  const ago = daysAgo(d, now);
  if (ago <= 0) return formatTime(iso);
  if (ago === 1) return t('chat.yesterday');
  if (ago < 7) return WEEKDAYS_SHORT[d.getDay()] ?? '';
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()] ?? ''}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
};

/** Sana ajratgichi: "Bugun", "Kecha", "12-oktabr", boshqa yil — "12-oktabr, 2025". */
export const formatDayLabel = (iso: string, now: Date = new Date()): string => {
  const d = parse(iso);
  if (!d) return '';
  const ago = daysAgo(d, now);
  if (ago <= 0) return t('chat.today');
  if (ago === 1) return t('chat.yesterday');
  const label = `${d.getDate()}-${MONTHS[d.getMonth()] ?? ''}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label}, ${d.getFullYear()}`;
};

/** Ikki vaqt bir kunga tegishlimi (sana ajratgichi uchun). */
export const sameDay = (a: string, b: string): boolean => {
  const da = parse(a);
  const db = parse(b);
  return !!da && !!db && startOfDay(da) === startOfDay(db);
};

/** "oxirgi marta ..." uchun: "bugun 14:20 da", "kecha 14:20 da", "05.01.2026 da". */
export const formatLastSeen = (iso: string, now: Date = new Date()): string => {
  const d = parse(iso);
  if (!d) return '';
  const ago = daysAgo(d, now);
  if (ago <= 0) return `bugun ${formatTime(iso)} da`;
  if (ago === 1) return `kecha ${formatTime(iso)} da`;
  return `${formatDate(d)} da`;
};

/** Direct chatda — suhbatdosh ismi; guruh/kanalda — sarlavha. */
export const chatTitle = (chat: ChatSummary, myId: string): string => {
  if (chat.type === 'direct') {
    const other = chat.members.find((m) => m.user.id !== myId);
    return other?.user.displayName ?? 'Suhbatdosh';
  }
  return chat.title ?? t('common.unknown');
};

export const directPeerId = (chat: ChatSummary, myId: string): string | null =>
  chat.type === 'direct' ? chat.members.find((m) => m.user.id !== myId)?.user.id ?? null : null;

export const messagePreview = (m: Message): string => {
  if (m.content) return m.content;
  switch (m.attachment?.kind) {
    case 'image': return '🖼 Rasm';
    case 'voice': return '🎤 Ovozli xabar';
    case 'file':  return `📎 ${m.attachment.name}`;
    default:      return '';
  }
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Avatar rangi — id (yoki ism) bo'yicha barqaror. */
export const avatarColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
};

/** Katta sonlar: 1200 → "1,2K". */
export const formatCount = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace('.', ',').replace(/,0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '')}M`;
};

/** Javob blokidagi matn: o'chirilgan → "O'chirilgan xabar", matnsiz biriktirma → turi. */
export const replyText = (r: MessageReply): string => {
  if (r.deleted) return t('reply.deleted');
  if (r.content) return r.content.replace(/\s+/g, ' ');
  switch (r.kind) {
    case 'image': return '🖼 Rasm';
    case 'voice': return '🎤 Ovozli xabar';
    case 'file':  return '📎 Fayl';
    default:      return '';
  }
};
