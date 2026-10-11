// src/hooks/useChats.ts
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchChats } from '../features/realtime/realtimeThunks';

export const useChats = () => {
  const dispatch  = useAppDispatch();
  const uid       = useAppSelector((s) => s.auth.user?.uid);
  const syncEpoch = useAppSelector((s) => s.chats.syncEpoch);
  const chats     = useAppSelector((s) => s.chats);

  useEffect(() => {
    if (uid) void dispatch(fetchChats());
  }, [uid, syncEpoch, dispatch]);

  return { ...chats, retry: () => dispatch(fetchChats()) };
};
