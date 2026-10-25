import { formatCallDuration } from '@suhbat/core';
import type { CallSessionEndReason, CallState } from './types.js';

const endText: Record<CallSessionEndReason, string> = {
  hangup:             'Qo\'ng\'iroq tugadi',
  rejected:           'Rad etildi',
  cancelled:          'Bekor qilindi',
  missed:             'Javob bermadi',
  busy:               'Band',
  disconnected:       'Aloqa uzildi',
  answered_elsewhere: 'Boshqa qurilmada qabul qilindi',
  failed:             'Ulanib bo\'lmadi',
  error:              'Xato',
};

/** Qo'ng'iroq ekranidagi holat matni (veb va mobil uchun bitta). */
export const callStatusText = (state: Pick<CallState<unknown>, 'phase' | 'direction' | 'media' | 'remoteRinging' | 'reconnecting' | 'connectedAt' | 'endReason' | 'error'>, now: number): string => {
  switch (state.phase) {
    case 'idle':
    case 'calling':
      return state.remoteRinging ? 'Jiringlamoqda…' : 'Qo\'ng\'iroq qilinmoqda…';
    case 'ringing':
      return state.media === 'video' ? 'Kiruvchi video qo\'ng\'iroq' : 'Kiruvchi qo\'ng\'iroq';
    case 'connecting':
      return 'Ulanmoqda…';
    case 'connected':
      if (state.reconnecting) return 'Aloqa tiklanmoqda…';
      return formatCallDuration(now - (state.connectedAt ?? now));
    case 'ended':
      if (state.endReason === 'error' && state.error) return state.error;
      return state.endReason ? endText[state.endReason] : endText.hangup;
  }
};

/**
 * Javob berilmagan kiruvchi qo'ng'iroq tugadi (bekor qilindi, javobsiz, boshqa qurilmada
 * qabul qilindi yoki o'zi rad etdi) — "tugadi" ekrani ko'rsatilmaydi, darhol yopiladi.
 */
export const isSilentEnd = (state: Pick<CallState<unknown>, 'phase' | 'direction' | 'endReason'>): boolean =>
  state.phase === 'ended' && state.direction === 'incoming' &&
  (state.endReason === 'cancelled' || state.endReason === 'missed' ||
    state.endReason === 'answered_elsewhere' || state.endReason === 'rejected');

/** Qo'ng'iroq ohangi: `ring` — kiruvchi jiringlash, `ringback` — chiquvchi kutish ovozi (veb va mobil uchun bitta qoida). */
export type CallTone = 'ring' | 'ringback';

export const callToneFor = (state: Pick<CallState<unknown>, 'phase' | 'direction'> | null): CallTone | null => {
  if (!state) return null;
  if (state.phase === 'ringing' && state.direction === 'incoming') return 'ring';
  if (state.phase === 'calling' && state.direction === 'outgoing') return 'ringback';
  return null;
};
