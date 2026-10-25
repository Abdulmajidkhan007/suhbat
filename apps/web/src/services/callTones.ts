// Qo'ng'iroq ohanglari (jiringlash / kutish ovozi): `public/sounds/*.wav` (scripts/gen-call-sounds.mjs).
// Brauzer autoplay cheklovi (foydalanuvchi sahifa bilan hali o'zaro aloqa qilmagan) `play()` ni rad etadi —
// xato yutilmaydi: `blocked` holati UI'ga beriladi va keyingi bosish/tugmada qayta uriniladi.
import type { CallTone } from '@suhbat/client';

export const TONE_URLS: Record<CallTone, string> = {
  ring:     '/sounds/ring.wav',
  ringback: '/sounds/ringback.wav',
};

export interface ToneAudio {
  src:    string;
  loop:   boolean;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
}

export interface CallTonePlayer {
  /** Ohangni yoqadi (`null` — o'chiradi). Xuddi shu ohang allaqachon yangrasa — hech narsa qilmaydi. */
  set(tone: CallTone | null): void;
  /** Ovoz ijro etib bo'lmadi (autoplay cheklovi va h.k.) — UI ogohlantiradi. */
  isBlocked(): boolean;
  subscribe(listener: (blocked: boolean) => void): () => void;
  dispose(): void;
}

export interface CallTonePlayerOptions {
  createAudio?: () => ToneAudio;
  /** Foydalanuvchi harakati (bosish/tugma) — bloklangan ovozni qayta urinish uchun. */
  onGesture?: (retry: () => void) => () => void;
  report?: (message: string, error: unknown) => void;
}

const gestureEvents = ['pointerdown', 'keydown'] as const;
const defaultOnGesture = (retry: () => void) => {
  gestureEvents.forEach((e) => window.addEventListener(e, retry, { once: true, capture: true }));
  return () => gestureEvents.forEach((e) => window.removeEventListener(e, retry, { capture: true }));
};

export const createCallTonePlayer = (opts: CallTonePlayerOptions = {}): CallTonePlayer => {
  const createAudio = opts.createAudio ?? (() => new Audio());
  const onGesture = opts.onGesture ?? defaultOnGesture;
  const report = opts.report ?? ((message, error) => console.warn(message, error));
  const listeners = new Set<(blocked: boolean) => void>();
  let audio: ToneAudio | null = null;
  let current: CallTone | null = null;
  let blocked = false;
  let offGesture: (() => void) | null = null;

  const setBlocked = (value: boolean) => {
    if (blocked === value) return;
    blocked = value;
    listeners.forEach((l) => l(blocked));
  };

  const stop = () => {
    offGesture?.();
    offGesture = null;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audio = null;
    current = null;
    setBlocked(false);
  };

  const start = (tone: CallTone) => {
    const el = createAudio();
    el.src = TONE_URLS[tone];
    el.loop = true;
    audio = el;
    current = tone;
    const attempt = () => {
      let played: Promise<void>;
      try {
        played = Promise.resolve(el.play()); // eski brauzerlarda `play()` promise qaytarmaydi
      } catch (e) {
        played = Promise.reject(e);
      }
      played.then(
        () => {
          if (audio === el) setBlocked(false);
        },
        (error: unknown) => {
          if (audio !== el) return; // ohang allaqachon o'zgargan/to'xtatilgan
          report(`Qo'ng'iroq ovozi ijro etilmadi (${tone})`, error);
          setBlocked(true);
          offGesture?.();
          offGesture = onGesture(attempt);
        },
      );
    };
    attempt();
  };

  return {
    set(tone) {
      if (tone === current) return;
      stop();
      if (tone) start(tone);
    },
    isBlocked: () => blocked,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stop();
      listeners.clear();
    },
  };
};

/** Ilova bo'yicha bitta o'ynatgich. */
export const callTonePlayer = createCallTonePlayer();
