import { useEffect, useState } from 'react';
import { normalizeUsername, usernameProblem } from '@suhbat/core';
import { api } from '../services/api';
import { useDebounce } from './useDebounce';

export type UsernameCheck =
  | { status: 'empty' }
  /** Joriy foydalanuvchining o'z username'i (profil). */
  | { status: 'current' }
  | { status: 'invalid'; message: string }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; message: string }
  | { status: 'error' };

/**
 * Jonli tekshiruv: format — darhol (mijozda, `@suhbat/core` qoidalari), bandlik —
 * 400 ms debounce bilan `GET /users/username-available`. Eskirgan javoblar tashlanadi.
 */
export const useUsernameCheck = (raw: string, current?: string | null): UsernameCheck => {
  const value = normalizeUsername(raw);
  const debounced = useDebounce(value, 400);
  const [remote, setRemote] = useState<{ value: string; check: UsernameCheck } | null>(null);

  const problem = value ? usernameProblem(value) : null;
  const needsRemote = Boolean(value) && !problem && value !== (current ?? null);

  useEffect(() => {
    if (!needsRemote || debounced !== value) return;
    let cancelled = false;
    api.checkUsername(debounced)
      .then((r) => {
        if (cancelled) return;
        setRemote({
          value: debounced,
          check: r.available ? { status: 'available' } : { status: 'taken', message: r.reason ?? 'Bu username band' },
        });
      })
      .catch(() => {
        if (!cancelled) setRemote({ value: debounced, check: { status: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, value, needsRemote]);

  if (!value) return { status: 'empty' };
  if (value === (current ?? null)) return { status: 'current' };
  if (problem) return { status: 'invalid', message: problem };
  return remote?.value === value ? remote.check : { status: 'checking' };
};

/** Formani yuborish mumkinmi (bo'sh — ixtiyoriy maydon sifatida mumkin). */
export const usernameAcceptable = (c: UsernameCheck): boolean =>
  c.status === 'empty' || c.status === 'current' || c.status === 'available' || c.status === 'error';
