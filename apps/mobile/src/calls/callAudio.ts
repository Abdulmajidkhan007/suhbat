import { callToneFor } from '@suhbat/client';
import type { CallManager } from '@suhbat/client';
import type { CallMedia } from '@suhbat/core';

/** `react-native-incall-manager` ning ishlatiladigan qismi (testda soxta bilan almashtiriladi). */
export interface InCallManagerLike {
  start(setup?: { auto?: boolean; media?: CallMedia; ringback?: string }): void;
  stop(setup?: { busytone?: string }): void;
  startRingtone(ringtone: string, vibratePattern: number | number[], iosCategory: string, seconds: number): void;
  stopRingtone(): void;
  stopRingback(): void;
  setForceSpeakerphoneOn(flag: boolean): void;
}

type StateOf = ReturnType<CallManager<unknown>['getState']>;
type Mode = 'idle' | 'ring' | 'ringback' | 'call';

export interface CallAudio {
  /** Qo'ng'iroq holatiga qarab jiringlash / kutish ovozi / audio marshrutni boshqaradi (takror chaqirish xavfsiz). */
  sync(state: StateOf): void;
  /** Karnay (`true`) yoki quloqchin/simli/Bluetooth (`false`) — faqat qo'ng'iroq davomida. */
  setSpeaker(on: boolean): void;
  isSpeakerOn(): boolean;
  subscribe(listener: () => void): () => void;
}

const RING_VIBRATION = [0, 800, 1200];

/**
 * Mobil qo'ng'iroq audiosi (`react-native-incall-manager`):
 * - kiruvchi jiringlash — tizim ringtone'i + tebranish (audio sessiya "qo'ng'iroq" rejimiga o'tmaydi);
 * - chiquvchi kutish — `start({ ringback })` (audio sessiya erta ochiladi);
 * - gaplashish — `start({ media })`: audio qo'ng'iroqda quloqchin, video'da karnay (`auto`), simli/Bluetooth
 *   ulansa avtomatik; foydalanuvchi `setSpeaker` bilan almashtiradi.
 * Native chaqiriq xato bersa qo'ng'iroq buzilmaydi — xato `report` ga yoziladi.
 */
export const createCallAudio = (
  manager: InCallManagerLike,
  report: (message: string, error: unknown) => void = (m, e) => console.warn(m, e),
): CallAudio => {
  const listeners = new Set<() => void>();
  let mode: Mode = 'idle';
  let speaker = false;

  const safe = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      report(`Qo'ng'iroq audiosi: ${what}`, e);
    }
  };
  const notify = () => listeners.forEach((l) => l());
  const setSpeakerState = (on: boolean) => {
    if (speaker === on) return;
    speaker = on;
    notify();
  };

  const modeOf = (state: StateOf): Mode => {
    const tone = callToneFor(state);
    if (tone === 'ring') return 'ring';
    if (tone === 'ringback') return 'ringback';
    return state && (state.phase === 'connecting' || state.phase === 'connected') ? 'call' : 'idle';
  };

  const leave = (from: Mode, to: Mode) => {
    if (from === 'ring') safe('stopRingtone', () => manager.stopRingtone());
    if (from === 'ringback') {
      safe('stopRingback', () => manager.stopRingback());
      if (to === 'call') return; // audio sessiya ochiq qoladi
    }
    if ((from === 'ringback' || from === 'call') && to !== 'call') safe('stop', () => manager.stop());
  };

  const enter = (from: Mode, to: Mode, media: CallMedia) => {
    if (to === 'ring') {
      safe('startRingtone', () => manager.startRingtone('_DEFAULT_', RING_VIBRATION, 'default', 0));
    } else if (to === 'ringback') {
      safe('start(ringback)', () => manager.start({ media, ringback: '_DTMF_' }));
      setSpeakerState(media === 'video');
    } else if (to === 'call') {
      if (from !== 'ringback') {
        safe('start', () => manager.start({ media }));
        setSpeakerState(media === 'video');
      }
    }
  };

  return {
    sync(state) {
      const next = modeOf(state);
      if (next === mode) return;
      const previous = mode;
      mode = next;
      leave(previous, next);
      enter(previous, next, state?.media ?? 'audio');
      if (next === 'idle') setSpeakerState(false);
    },
    setSpeaker(on) {
      if (mode !== 'call' && mode !== 'ringback') return;
      safe('setForceSpeakerphoneOn', () => manager.setForceSpeakerphoneOn(on));
      setSpeakerState(on);
    },
    isSpeakerOn: () => speaker,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
