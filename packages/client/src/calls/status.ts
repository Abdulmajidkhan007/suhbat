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
