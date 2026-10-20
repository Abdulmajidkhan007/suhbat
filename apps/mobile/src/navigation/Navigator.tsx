import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler } from 'react-native';

/**
 * Stek navigatsiya + pastki tablar — native navigatsiya kutubxonasisiz (ekranlar kam, qo'shimcha
 * native modul va uning build xavfi kerak emas). Ildizda — tablar, ustiga ekranlar push qilinadi.
 */
export type TabName = 'chats' | 'settings';

export type Route =
  | { name: 'tabs' }
  | { name: 'chat'; chatId: string }
  | { name: 'chatInfo'; chatId: string }
  | { name: 'addMembers'; chatId: string }
  | { name: 'newChat' }
  | { name: 'newGroup'; kind: 'group' | 'channel' }
  | { name: 'profile' }
  | { name: 'appearance' }
  | { name: 'security' };

interface NavigationValue {
  route:   Route;
  /** Stek chuqurligi (o'tish animatsiyasi kaliti uchun). */
  depth:   number;
  tab:     TabName;
  setTab:  (tab: TabName) => void;
  push:    (route: Route) => void;
  replace: (route: Route) => void;
  back:    () => boolean;
  /** Ildizga (tablarga) qaytish — masalan, chat o'chirilganda. */
  reset:   (tab?: TabName) => void;
}

const HOME: Route = { name: 'tabs' };

const NavigationContext = createContext<NavigationValue | null>(null);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [stack, setStack] = useState<Route[]>([HOME]);
  const [tab, setTab] = useState<TabName>('chats');

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const replace = useCallback((route: Route) => setStack((s) => [...s.slice(0, -1), route]), []);
  const reset = useCallback((next?: TabName) => {
    setStack([HOME]);
    if (next) setTab(next);
  }, []);
  const back = useCallback(() => {
    if (stack.length > 1) {
      setStack((s) => s.slice(0, -1));
      return true;
    }
    // Ildizda: Sozlamalar tabidan — Suhbatlarga; Suhbatlarda — tizimga (ilovadan chiqish).
    if (tab !== 'chats') {
      setTab('chats');
      return true;
    }
    return false;
  }, [stack.length, tab]);

  // Android "orqaga" tugmasi.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const value = useMemo(
    () => ({ route: stack[stack.length - 1] ?? HOME, depth: stack.length, tab, setTab, push, replace, back, reset }),
    [stack, tab, push, replace, back, reset],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = (): NavigationValue => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation NavigationProvider ichida ishlatilishi kerak');
  return ctx;
};
