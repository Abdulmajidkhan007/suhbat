import { useEffect, useSyncExternalStore } from 'react';
import { callToneFor } from '@suhbat/client';
import { useCall } from './useCall';
import { callTonePlayer } from '../services/callTones';

/**
 * Qo'ng'iroq holatiga qarab jiringlash/kutish ovozini yoqadi va o'chiradi. Qaytaradi — ovoz
 * ijro etilmadi (autoplay cheklovi): UI buni foydalanuvchiga ko'rsatadi.
 */
export const useCallTone = (): boolean => {
  const tone = callToneFor(useCall());
  useEffect(() => {
    callTonePlayer.set(tone);
    return () => callTonePlayer.set(null);
  }, [tone]);
  return useSyncExternalStore(callTonePlayer.subscribe, callTonePlayer.isBlocked);
};
