// src/utils/validators.ts

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

export const isValidDisplayName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};

export interface ValidationResult {
  valid:   boolean;
  message: string;
}

export const validateSignIn = (email: string, password: string): ValidationResult => {
  if (!email.trim())         return { valid: false, message: 'Email is required.' };
  if (!isValidEmail(email))  return { valid: false, message: 'Enter a valid email address.' };
  if (!password)             return { valid: false, message: 'Password is required.' };
  return { valid: true, message: '' };
};

export const validateSignUp = (
  email:       string,
  password:    string,
  displayName: string,
): ValidationResult => {
  if (!displayName.trim())             return { valid: false, message: 'Name is required.' };
  if (!isValidDisplayName(displayName)) return { valid: false, message: 'Name must be 2-50 characters.' };
  if (!email.trim())                   return { valid: false, message: 'Email is required.' };
  if (!isValidEmail(email))            return { valid: false, message: 'Enter a valid email address.' };
  if (!password)                       return { valid: false, message: 'Password is required.' };
  if (!isValidPassword(password))      return { valid: false, message: 'Password must be at least 6 characters.' };
  return { valid: true, message: '' };
};
