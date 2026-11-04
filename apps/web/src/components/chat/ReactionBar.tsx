import React from 'react';
import { ButtonBase, Typography } from '@mui/material';
import type { MessageReaction, ReactionEmoji } from '@suhbat/core';

interface Props {
  reactions:  readonly MessageReaction[];
  /** Joriy foydalanuvchining reaksiyasi (ajratib ko'rsatiladi). */
  mine:       ReactionEmoji | null | undefined;
  /** Bosish: o'zining reaksiyasi bo'lsa olib tashlash, boshqasi bo'lsa almashtirish. */
  onToggle?:  (emoji: ReactionEmoji) => void;
  /** Ko'k (o'z) xabar ichida emas, uning ostida ko'rsatiladi — ranglar ikkala mavzuda ham o'qiladi. */
  align?:     'start' | 'end';
}

/** Xabar ostida emoji + soni; o'zining reaksiyasi ajralib turadi. */
const ReactionBar: React.FC<Props> = ({ reactions, mine, onToggle, align = 'start' }) => {
  if (reactions.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap gap-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}
      role="group"
      aria-label="Reaksiyalar"
    >
      {reactions.map(({ emoji, count }) => {
        const active = mine === emoji;
        return (
          <ButtonBase
            key={emoji}
            disabled={!onToggle}
            onClick={() => onToggle?.(emoji)}
            aria-pressed={active}
            aria-label={`${emoji} ${count}${active ? ' (siz)' : ''}`}
            className={`!rounded-full !px-2 !py-0.5 !gap-1 border text-sm ${
              active
                ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200'
            }`}
          >
            <span aria-hidden>{emoji}</span>
            <Typography component="span" variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>{count}</Typography>
          </ButtonBase>
        );
      })}
    </div>
  );
};

export default ReactionBar;
