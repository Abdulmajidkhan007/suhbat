import type { PublicChannel, PublicUser } from '@suhbat/core';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../state/SessionProvider';

export const SEARCH_DEBOUNCE_MS = 300;

export interface GlobalSearch {
  /** So'rov yozilgan — qidiruv rejimi. */
  active:        boolean;
  /** Debounce kutilmoqda yoki so'rov yo'lda. */
  loading:       boolean;
  users:         PublicUser[];
  channels:      PublicChannel[];
  usersError:    boolean;
  channelsError: boolean;
  retry:         () => void;
}

interface Result {
  query:         string;
  users:         PublicUser[];
  channels:      PublicChannel[];
  usersError:    boolean;
  channelsError: boolean;
}

/**
 * Global qidiruv: foydalanuvchilar va ochiq kanallar parallel (har biri alohida xato bilan);
 * eskirgan javoblar tashlanadi. Veb'dagi `useGlobalSearch` bilan bir xil xulq.
 */
export const useGlobalSearch = (query: string, delay = SEARCH_DEBOUNCE_MS): GlobalSearch => {
  const { services: { api } } = useSession();
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!trimmed) {
      setDebounced('');
      return;
    }
    const timer = setTimeout(() => setDebounced(trimmed), delay);
    return () => clearTimeout(timer);
  }, [trimmed, delay]);

  useEffect(() => {
    if (!debounced) {
      setResult(null);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([api.searchUsers(debounced), api.searchPublicChannels(debounced)]).then(([users, channels]) => {
      if (cancelled) return;
      setResult({
        query:         debounced,
        users:         users.status === 'fulfilled' ? users.value : [],
        channels:      channels.status === 'fulfilled' ? channels.value : [],
        usersError:    users.status === 'rejected',
        channelsError: channels.status === 'rejected',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [api, debounced, attempt]);

  const retry = useCallback(() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);

  const fresh = result !== null && result.query === trimmed;
  return {
    active:        trimmed.length > 0,
    loading:       trimmed.length > 0 && !fresh,
    users:         fresh ? result.users : [],
    channels:      fresh ? result.channels : [],
    usersError:    fresh && result.usersError,
    channelsError: fresh && result.channelsError,
    retry,
  };
};
