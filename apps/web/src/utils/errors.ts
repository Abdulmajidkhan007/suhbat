import { ApiError } from '@suhbat/client';

/** Foydalanuvchiga ko'rsatiladigan xato matni: server xabari (o'zbekcha) yoki zaxira matn. */
export const errorText = (e: unknown, fallback: string): string => {
  if (e instanceof ApiError && e.status !== 0 && e.status < 500 && e.message && !/^HTTP \d+$/.test(e.message)) {
    return e.message;
  }
  if (e instanceof ApiError && e.status === 0) return e.message;
  return fallback;
};
