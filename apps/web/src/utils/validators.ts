// src/utils/validators.ts

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8 && password.length <= 128;
};

export const isValidDisplayName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};

export interface ValidationResult {
  valid:   boolean;
  message: string;
}

export const validateSignIn = (email: string, password: string): ValidationResult => {
  if (!email.trim())         return { valid: false, message: 'Email kiriting.' };
  if (!isValidEmail(email))  return { valid: false, message: 'Email manzili noto\'g\'ri.' };
  if (!password)             return { valid: false, message: 'Parol kiriting.' };
  return { valid: true, message: '' };
};

export const validateSignUp = (
  email:       string,
  password:    string,
  displayName: string,
): ValidationResult => {
  if (!displayName.trim())             return { valid: false, message: 'Ismingizni kiriting.' };
  if (!isValidDisplayName(displayName)) return { valid: false, message: 'Ism 2 dan 50 tagacha belgi bo\'lishi kerak.' };
  if (!email.trim())                   return { valid: false, message: 'Email kiriting.' };
  if (!isValidEmail(email))            return { valid: false, message: 'Email manzili noto\'g\'ri.' };
  if (!password)                       return { valid: false, message: 'Parol kiriting.' };
  if (!isValidPassword(password))      return { valid: false, message: 'Parol kamida 8 ta belgi bo\'lishi kerak.' };
  return { valid: true, message: '' };
};
