import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler } from 'react-native';

/**
 * Minimal stek navigatsiya (4 ekran) — native navigatsiya kutubxonasisiz.
 * Ekranlar ko'payganda (sozlamalar, chat ma'lumotlari, media) React Navigation'ga o'tiladi.
 */
export type Route =
  | { name: 'chats' }
  | { name: 'chat'; chatId: string }
  | { name: 'newChat' }
  | { name: 'profile' };

interface NavigationValue {
  route:   Route;
  push:    (route: Route) => void;
  replace: (route: Route) => void;
  back:    () => boolean;
}

const HOME: Route = { name: 'chats' };

const NavigationContext = createContext<NavigationValue | null>(null);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [stack, setStack] = useState<Route[]>([HOME]);

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const replace = useCallback((route: Route) => setStack((s) => [...s.slice(0, -1), route]), []);
  const back = useCallback(() => {
    if (stack.length <= 1) return false;
    setStack((s) => s.slice(0, -1));
    return true;
  }, [stack.length]);

  // Android "orqaga" tugmasi: stekda ekran bo'lsa — orqaga, aks holda tizimga.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const value = useMemo(
    () => ({ route: stack[stack.length - 1] ?? HOME, push, replace, back }),
    [stack, push, replace, back],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = (): NavigationValue => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation NavigationProvider ichida ishlatilishi kerak');
  return ctx;
};
