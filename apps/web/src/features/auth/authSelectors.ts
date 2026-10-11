// src/features/auth/authSelectors.ts
import { RootState } from '../../app/store';

export const selectCurrentUser    = (s: RootState) => s.auth.user;
export const selectAuthLoading    = (s: RootState) => s.auth.loading;
export const selectAuthError      = (s: RootState) => s.auth.error;
export const selectAuthInitialized = (s: RootState) => s.auth.initialized;
