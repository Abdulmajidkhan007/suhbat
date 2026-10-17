import type { LoginInput, RegisterInput, User } from '@suhbat/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getAppServices, onAppSessionExpired } from '../services/createServices';
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
  /** Profil tahrirlangach joriy foydalanuvchini yangilaydi. */
  updateUser: (user: User) => void;
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
  const [services] = useState<Services>(() => injected ?? getAppServices());
  const { api, socket, push, calls, connection, background } = services;

  expiredRef.current = () => {
    background.stop();
    calls.hangup();
    socket.disconnect();
    setSession({ status: 'signedOut', expired: true });
  };
  useEffect(() => (injected ? undefined : onAppSessionExpired(() => expiredRef.current())), [injected]);

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
  // Ochiq UI ulanishni talab qiladi; fon ulanishi (yoqilgan bo'lsa) — o'z talabi bilan.
  useEffect(() => (signedIn ? connection.hold() : undefined), [signedIn, connection]);
  useEffect(() => {
    if (signedIn) void background.sync();
  }, [signedIn, background]);

  const login = useCallback(async (input: LoginInput) => {
    setSession({ status: 'signedIn', user: await api.login(input) });
  }, [api]);

  const register = useCallback(async (input: RegisterInput) => {
    setSession({ status: 'signedIn', user: await api.register(input) });
  }, [api]);

  const updateUser = useCallback((user: User) => {
    setSession((s) => (s.status === 'signedIn' ? { status: 'signedIn', user } : s));
  }, []);

  const logout = useCallback(async () => {
    background.stop();
    calls.hangup();
    socket.disconnect();
    // Shu qurilmaning push tokeni serverdan va FCM'dan o'chadi — chiqqan hisobga push bormaydi.
    const deviceToken = push.available ? await push.getToken().catch(() => null) : null;
    await api.logout(deviceToken ? { deviceToken } : {});
    if (deviceToken) await push.deleteToken().catch(() => undefined);
    setSession({ status: 'signedOut', expired: false });
  }, [api, socket, push, calls, background]);

  const value = useMemo(
    () => ({ session, services, login, register, logout, updateUser }),
    [session, services, login, register, logout, updateUser],
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
