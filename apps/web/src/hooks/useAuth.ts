// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { restoreSession, setUser } from '../features/auth/authSlice';
import { resetChats } from '../features/chats/chatsSlice';
import { resetMessages } from '../features/messages/messagesSlice';
import { resetPresence } from '../features/presence/presenceSlice';
import { setSessionExpiredHandler, socket } from '../services/api';

/** Sessiyani tiklaydi va WebSocket'ni foydalanuvchi bilan birga ulab/uzadi. */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const auth     = useAppSelector((s) => s.auth);
  // Vaqtinchalik parol almashtirilguncha server socket'ni qabul qilmaydi — ulanishga urinmaymiz.
  const uid      = auth.user && !auth.user.mustChangePassword ? auth.user.uid : undefined;

  useEffect(() => {
    setSessionExpiredHandler(() => dispatch(setUser(null)));
    void dispatch(restoreSession());
  }, [dispatch]);

  useEffect(() => {
    if (!uid) return;
    socket.connect();
    return () => {
      socket.disconnect();
      dispatch(resetChats());
      dispatch(resetMessages());
      dispatch(resetPresence());
    };
  }, [uid, dispatch]);

  return auth;
};
