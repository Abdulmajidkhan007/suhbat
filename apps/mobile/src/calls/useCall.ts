import type { CallState } from '@suhbat/client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MediaStream } from 'react-native-webrtc';
import { useSession } from '../state/SessionProvider';

/** Joriy qo'ng'iroq holati (`null` — qo'ng'iroq yo'q). */
export const useCall = (): CallState<MediaStream> | null => {
  const { services: { calls } } = useSession();
  return useSyncExternalStore(calls.subscribe, calls.getState);
};

/** Har soniyada yangilanadigan vaqt (taymer) — faqat `active` bo'lsa. */
export const useNow = (active: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
};
