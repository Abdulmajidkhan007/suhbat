// src/hooks/useChats.ts
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setChats, setChatsError, setChatsLoading } from '../features/chats/chatsSlice';
import { subscribeToChats } from '../services/chatService';

export const useChats = () => {
  const dispatch = useAppDispatch();
  const user     = useAppSelector((s) => s.auth.user);
  const chats    = useAppSelector((s) => s.chats);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;

    dispatch(setChatsLoading(true));

    unsubRef.current = subscribeToChats(
      user.uid,
      (chats) => dispatch(setChats(chats)),
      (err)   => dispatch(setChatsError(err.message)),
    );

    return () => {
      unsubRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, dispatch]);

  return chats;
};
