import type { LoginInput, RegisterInput, User } from '@suhbat/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createServices } from '../services/createServices';
import type { Services } from '../services/createServices';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; expired: boolean }
  | { status: 'signedIn'; user: User };

interface SessionContextValue {
  session:  SessionState;
  services: Services;
  login:    (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout:   () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface Props {
  children: ReactNode;
  /** Testlar uchun. */
  services?: Services;
}

export const SessionProvider = ({ children, services: injected }: Props) => {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const expiredRef = useRef<() => void>(() => undefined);
  const [services] = useState<Services>(
    () => injected ?? createServices({ onSessionExpired: () => expiredRef.current() }),
  );
  const { api, socket, push, calls } = services;

  expiredRef.current = () => {
    calls.hangup();
    socket.disconnect();
    setSession({ status: 'signedOut', expired: true });
  };

  // Ishga tushganda: Keychain'da token bo'lsa sessiyani tiklash.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = (await api.hasSession()) ? await api.me() : null;
        if (!cancelled) setSession(user ? { status: 'signedIn', user } : { status: 'signedOut', expired: false });
      } catch {
        // Tarmoq xatosi va h.k. — tokenlar o'chirilmaydi, lekin kirish ekrani ko'rsatiladi.
        if (!cancelled) setSession({ status: 'signedOut', expired: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const signedIn = session.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    socket.connect();
    return () => socket.disconnect();
  }, [signedIn, socket]);

  const login = useCallback(async (input: LoginInput) => {
    setSession({ status: 'signedIn', user: await api.login(input) });
  }, [api]);

  const register = useCallback(async (input: RegisterInput) => {
    setSession({ status: 'signedIn', user: await api.register(input) });
  }, [api]);

  const logout = useCallback(async () => {
    calls.hangup();
    socket.disconnect();
    // Shu qurilmaning push tokeni serverdan va FCM'dan o'chadi — chiqqan hisobga push bormaydi.
    const deviceToken = push.available ? await push.getToken().catch(() => null) : null;
    await api.logout(deviceToken ? { deviceToken } : {});
    if (deviceToken) await push.deleteToken().catch(() => undefined);
    setSession({ status: 'signedOut', expired: false });
  }, [api, socket, push, calls]);

  const value = useMemo(
    () => ({ session, services, login, register, logout }),
    [session, services, login, register, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession SessionProvider ichida ishlatilishi kerak');
  return ctx;
};

/** Faqat kirgan foydalanuvchi ekranlari uchun. */
export const useCurrentUser = (): User => {
  const { session } = useSession();
  if (session.status !== 'signedIn') throw new Error('Foydalanuvchi tizimga kirmagan');
  return session.user;
};
