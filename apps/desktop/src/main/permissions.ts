/** Sahifa so'ragan media turi (Electron `MediaAccessPermissionRequest.mediaTypes`). */
export type RequestedMedia = 'audio' | 'video';

/**
 * Ruxsat faqat o'z sahifamizga va faqat mikrofon/kameraga (ovozli xabar, qo'ng'iroq).
 * Ekran ulashish, joylashuv, bildirishnoma va boshqalar — rad.
 * `mediaTypes` bo'sh/yo'q bo'lsa ham `media` so'rovi (masalan, faqat qurilmalar ro'yxati) ruxsat.
 */
export const isMediaPermissionAllowed = (
  permission: string,
  ownPage: boolean,
  mediaTypes: readonly string[] = [],
): boolean => {
  if (!ownPage || permission !== 'media') return false;
  return mediaTypes.every((t) => t === 'audio' || t === 'video');
};
