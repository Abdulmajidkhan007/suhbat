/** Brauzer qo'llab-quvvatlaydigan birinchi ovoz formati (Chrome/Firefox — webm/ogg, Safari — mp4). */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'] as const;

export const pickRecorderMime = (isSupported: (mime: string) => boolean): string | null =>
  CANDIDATES.find((m) => isSupported(m)) ?? null;

/** `NotAllowedError` va boshqalarni foydalanuvchiga tushunarli matnga aylantiradi. */
export const recorderErrorMessage = (e: unknown): string => {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mikrofonga ruxsat berilmagan.';
  if (name === 'NotFoundError') return 'Mikrofon topilmadi.';
  return 'Ovoz yozib bo\'lmadi.';
};
