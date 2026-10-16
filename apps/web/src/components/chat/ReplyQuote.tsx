import React from 'react';
import type { MessageReply } from '@suhbat/core';
import { getAvatarColor } from '../../utils/colors';

/** Javob blokidagi matn: o'chirilgan → "O'chirilgan xabar", matnsiz biriktirma → turi. */
export const replyText = (r: MessageReply): string => {
  if (r.deleted) return 'O\'chirilgan xabar';
  if (r.content) return r.content.replace(/\s+/g, ' ');
  switch (r.kind) {
    case 'image': return '🖼 Rasm';
    case 'voice': return '🎤 Ovozli xabar';
    case 'file':  return '📎 Fayl';
    default:      return '';
  }
};

interface Props {
  reply:    MessageReply;
  name:     string;
  /** Bosilganda asl xabarga o'tish (o'chirilgan bo'lsa — yo'q). */
  onJump?:  (messageId: string) => void;
  /** To'q (o'z, ko'k) pufak ichida — rang o'rniga oq tus (kontrast). */
  onDark?:  boolean;
}

/** Javob berilgan xabar bloki (pufak ichida): rangli chiziq, muallif, matn boshi. */
const ReplyQuote: React.FC<Props> = ({ reply, name, onJump, onDark = false }) => {
  const color = onDark ? '#ffffff' : getAvatarColor(reply.senderId);
  const text = replyText(reply);
  const jump = !reply.deleted && onJump ? () => onJump(reply.id) : undefined;
  return (
    <button
      type="button"
      onClick={jump}
      disabled={!jump}
      aria-label={`Javob: ${name}: ${text}`}
      title={jump ? 'Asl xabarga o\'tish' : undefined}
      className="block w-full text-left rounded-md px-2 py-1 mb-1 border-l-[3px] min-w-[120px] disabled:cursor-default"
      style={{ borderLeftColor: color, backgroundColor: `${color}22` }}
    >
      <span className="block text-xs font-semibold truncate" style={{ color }}>{name}</span>
      <span className={`block text-xs truncate opacity-90 ${reply.deleted ? 'italic opacity-70' : ''}`}>{text}</span>
    </button>
  );
};

export default ReplyQuote;
