import React, { memo } from 'react';
import { Typography } from '@mui/material';
import { Message } from '../../types';
import { formatMessageTime } from '../../utils/formatters';

/** Tizim xabari (masalan, qo'ng'iroq natijasi) — markazda, pufakchasiz. */
const SystemMessage: React.FC<{ message: Message }> = memo(({ message }) => (
  <div className="flex justify-center my-1" role="note">
    <Typography
      variant="caption"
      className="px-3 py-1 rounded-full bg-gray-200/80 text-gray-700 dark:bg-gray-700/80 dark:text-gray-200"
      sx={{ fontSize: '0.75rem' }}
    >
      {message.content}
      <span className="opacity-60"> · {formatMessageTime(message.createdAt)}</span>
    </Typography>
  </div>
));
SystemMessage.displayName = 'SystemMessage';

export default SystemMessage;
