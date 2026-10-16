import { normalizeUsername, usernameProblem } from '@suhbat/core';
import { useEffect, useState } from 'react';
import { useSession } from '../state/SessionProvider';

export type UsernameCheck =
  | { status: 'empty' }
  | { status: 'current' }
  | { status: 'invalid'; message: string }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; message: string }
  | { status: 'error' };

const DEBOUNCE_MS = 400;

/** Format — darhol (`@suhbat/core`), bandlik — debounce bilan `GET /users/username-available`. */
export const useUsernameCheck = (raw: string, current?: string | null): UsernameCheck => {
  const { services: { api } } = useSession();
  const value = normalizeUsername(raw);
  const problem = value ? usernameProblem(value) : null;
  const needsRemote = Boolean(value) && !problem && value !== (current ?? null);
  const [remote, setRemote] = useState<{ value: string; check: UsernameCheck } | null>(null);

  useEffect(() => {
    if (!needsRemote) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.checkUsername(value)
        .then((r) => {
          if (!cancelled) {
            setRemote({ value, check: r.available ? { status: 'available' } : { status: 'taken', message: r.reason ?? 'Bu username band' } });
          }
        })
        .catch(() => {
          if (!cancelled) setRemote({ value, check: { status: 'error' } });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, value, needsRemote]);

  if (!value) return { status: 'empty' };
  if (value === (current ?? null)) return { status: 'current' };
  if (problem) return { status: 'invalid', message: problem };
  return remote?.value === value ? remote.check : { status: 'checking' };
};

export const usernameAcceptable = (c: UsernameCheck): boolean =>
  c.status === 'empty' || c.status === 'current' || c.status === 'available' || c.status === 'error';

export const usernameHint = (c: UsernameCheck, optional: boolean): string => {
  switch (c.status) {
    case 'empty':     return optional ? 'Username ixtiyoriy — keyin profilda o\'rnatish mumkin' : 'Username yo\'q';
    case 'current':   return 'Joriy username';
    case 'invalid':   return c.message;
    case 'checking':  return 'Tekshirilmoqda…';
    case 'available': return 'Bo\'sh — olish mumkin';
    case 'taken':     return c.message;
    case 'error':     return 'Tekshirib bo\'lmadi — saqlashda server tekshiradi';
  }
};
