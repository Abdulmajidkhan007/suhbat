// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { setUser } from '../features/auth/authSlice';
import { onAuthChange } from '../services/authService';
import { initPresence } from '../services/presenceService';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const auth     = useAppSelector((s) => s.auth);

  useEffect(() => {
    let cleanupPresence: (() => void) | null = null;

    const unsubAuth = onAuthChange((user) => {
      dispatch(setUser(user));
      if (user) {
        cleanupPresence = initPresence(user.uid);
      } else {
        cleanupPresence?.();
        cleanupPresence = null;
      }
    });

    return () => {
      unsubAuth();
      cleanupPresence?.();
    };
  }, [dispatch]);

  return auth;
};
