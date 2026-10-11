// src/hooks/usePresence.ts
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setPresence } from '../features/presence/presenceSlice';
import { subscribeToPresence } from '../services/presenceService';

export const usePresence = (userIds: string[]) => {
  const dispatch    = useAppDispatch();
  const onlineUsers = useAppSelector((s) => s.presence.onlineUsers);

  // Stable key from joined IDs — intentional dep expression
  const idsKey = userIds.join(',');

  useEffect(() => {
    if (userIds.length === 0) return;
    const unsub = subscribeToPresence(userIds, (map) => dispatch(setPresence(map)));
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, dispatch]);

  const isOnline = (uid: string) => onlineUsers[uid] ?? false;

  return { onlineUsers, isOnline };
};
