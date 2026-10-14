import { useSyncExternalStore } from 'react';
import type { CallState } from '@suhbat/client';
import { callManager } from '../services/calls';

/** Joriy qo'ng'iroq holati (`null` — qo'ng'iroq yo'q). */
export const useCall = (): CallState<MediaStream> | null =>
  useSyncExternalStore(callManager.subscribe, callManager.getState);
