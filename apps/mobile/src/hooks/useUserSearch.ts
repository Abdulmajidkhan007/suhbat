import type { PublicUser } from '@suhbat/core';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../state/SessionProvider';
import { SEARCH_DEBOUNCE_MS } from './useGlobalSearch';

export interface UserSearch {
  results: PublicUser[];
  loading: boolean;
  error:   boolean;
  retry:   () => void;
}

/** Foydalanuvchi qidiruvi (debounce, eskirgan javob tashlanadi) — yangi suhbat va a'zo qo'shish uchun. */
export const useUserSearch = (query: string): UserSearch => {
  const { services: { api } } = useSession();
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api.searchUsers(q).then(
        (users) => {
          if (cancelled) return;
          setResults(users);
          setError(false);
        },
        () => {
          if (!cancelled) setError(true);
        },
      ).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, query, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { results, loading, error, retry };
};
