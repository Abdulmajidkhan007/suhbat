import React from 'react';
import { Skeleton, Box } from '@mui/material';

interface ChatSkeletonProps {
  count?: number;
}

export const ChatListSkeleton: React.FC<ChatSkeletonProps> = ({ count = 6 }) => (
  <div className="flex flex-col gap-1 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <Box key={i} className="flex items-center gap-3 px-3 py-2">
        <Skeleton variant="circular" width={44} height={44} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" height={16} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="80%" height={13} />
        </div>
        <Skeleton variant="text" width={32} height={12} />
      </Box>
    ))}
  </div>
);

export const MessageSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="flex flex-col gap-4 p-4">
    {Array.from({ length: count }).map((_, i) => {
      const isSelf = i % 2 === 0;
      return (
        <Box key={i} className={`flex items-end gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton
            variant="rounded"
            width={`${30 + Math.random() * 30}%`}
            height={44}
            sx={{ borderRadius: '12px' }}
          />
        </Box>
      );
    })}
  </div>
);
