import { useCallback, useEffect, useState } from 'react';
import type { PublicChannel } from '@suhbat/core';
import { api } from '../services/api';
import { toAppUser } from '../services/apiMappers';
import { AppUser } from '../types';
import { useDebounce } from './useDebounce';

export const SEARCH_DEBOUNCE_MS = 300;

export interface GlobalSearchState {
  /** So'rov yozilmagan — qidiruv o'chiq. */
  active:        boolean;
  /** Debounce kutilmoqda yoki so'rov yo'lda. */
  loading:       boolean;
  users:         AppUser[];
  channels:      PublicChannel[];
  usersError:    boolean;
  channelsError: boolean;
  retry:         () => void;
}

interface Result {
  query:         string;
  users:         AppUser[];
  channels:      PublicChannel[];
  usersError:    boolean;
  channelsError: boolean;
}

/**
 * Global qidiruv: foydalanuvchilar (`/users/search`) va ochiq kanallar (`/chats/public`)
 * parallel, har biri alohida xatolik bilan (bittasi yiqilsa ikkinchisi ko'rinadi).
 * Eskirgan javoblar (tezda yozilgan keyingi so'rov) tashlab yuboriladi.
 */
export const useGlobalSearch = (query: string, delay = SEARCH_DEBOUNCE_MS): GlobalSearchState => {
  const trimmed   = query.trim();
  const debounced = useDebounce(trimmed, delay);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!debounced) { setResult(null); return; }
    let cancelled = false;
    void Promise.allSettled([api.searchUsers(debounced), api.searchPublicChannels(debounced)]).then(
      ([users, channels]) => {
        if (cancelled) return;
        setResult({
          query:         debounced,
          users:         users.status === 'fulfilled' ? users.value.map(toAppUser) : [],
          channels:      channels.status === 'fulfilled' ? channels.value : [],
          usersError:    users.status === 'rejected',
          channelsError: channels.status === 'rejected',
        });
      },
    );
    return () => { cancelled = true; };
  }, [debounced, attempt]);

  const retry = useCallback(() => { setResult(null); setAttempt((n) => n + 1); }, []);

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
