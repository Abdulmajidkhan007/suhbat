import type { ChatSummary, Message } from '@suhbat/core';

const pad = (n: number) => String(n).padStart(2, '0');

/** `14:05` — mahalliy vaqt. */
export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Direct chatda — suhbatdosh ismi; guruh/kanalda — sarlavha. */
export const chatTitle = (chat: ChatSummary, myId: string): string => {
  if (chat.type === 'direct') {
    const other = chat.members.find((m) => m.user.id !== myId);
    return other?.user.displayName ?? 'Suhbatdosh';
  }
  return chat.title ?? 'Nomsiz';
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
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
