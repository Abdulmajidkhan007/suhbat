import React from 'react';
import { ButtonBase, Popover } from '@mui/material';
import { REACTION_EMOJIS } from '@suhbat/core';
import type { ReactionEmoji } from '@suhbat/core';

interface Props {
  anchorEl: HTMLElement | null;
  onClose:  () => void;
  /** Tanlangan emoji; o'zining reaksiyasi ajratib ko'rsatiladi (yana bossa olib tashlanadi). */
  current:  ReactionEmoji | null | undefined;
  onPick:   (emoji: ReactionEmoji) => void;
}

/** 6 ta emoji qatori (👍 ❤️ 😂 😮 😢 🔥). */
const ReactionPicker: React.FC<Props> = ({ anchorEl, onClose, current, onPick }) => (
  <Popover
    open={Boolean(anchorEl)}
    anchorEl={anchorEl}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    slotProps={{ paper: { sx: { borderRadius: '9999px', px: 0.5, py: 0.25 } } }}
  >
    <div className="flex items-center gap-0.5" role="menu" aria-label="Reaksiya tanlash">
      {REACTION_EMOJIS.map((emoji) => (
        <ButtonBase
          key={emoji}
          role="menuitemradio"
          aria-checked={current === emoji}
          aria-label={emoji}
          onClick={() => { onPick(emoji); onClose(); }}
          className={`!rounded-full !w-10 !h-10 !text-2xl transition-transform hover:scale-125 ${
            current === emoji ? 'bg-blue-500/20' : ''
          }`}
        >
          <span aria-hidden>{emoji}</span>
        </ButtonBase>
      ))}
    </div>
  </Popover>
);

export default ReactionPicker;
