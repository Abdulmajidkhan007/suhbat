import { PASSWORD_MIN } from '@suhbat/core';

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  level: StrengthLevel;
  label: string;
}

const LABELS: Record<StrengthLevel, string> = {
  0: 'Juda qisqa',
  1: 'Zaif',
  2: 'O\'rtacha',
  3: 'Yaxshi',
  4: 'Kuchli',
};

/**
 * Oddiy evristika (uzunlik + belgi turlari) — faqat foydalanuvchiga ko'rsatma.
 * Server faqat uzunlikni talab qiladi (8–128).
 */
export const passwordStrength = (password: string): PasswordStrength => {
  if (password.length < PASSWORD_MIN) return { level: 0, label: LABELS[0] };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (kinds >= 2) score += 1;
  if (kinds >= 3) score += 1;
  // Bir xil belgi takrori ("aaaaaaaa", "11111111") — zaif.
  if (/^(.)\1+$/.test(password)) score = 1;
  const level = Math.min(4, score) as StrengthLevel;
  return { level, label: LABELS[level] };
};
