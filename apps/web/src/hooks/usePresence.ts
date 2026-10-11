// src/hooks/usePresence.ts
import { useCallback } from 'react';
import { useAppSelector } from '../app/hooks';

/** Onlayn holat WebSocket orqali keladi (`useRealtime`). */
export const usePresence = () => {
  const onlineUsers = useAppSelector((s) => s.presence.onlineUsers);
  const isOnline    = useCallback((uid: string) => onlineUsers[uid] ?? false, [onlineUsers]);
  return { onlineUsers, isOnline };
};
