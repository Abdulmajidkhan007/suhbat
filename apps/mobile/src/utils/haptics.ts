import { trigger } from 'react-native-haptic-feedback';

/**
 * Yengil tebranish (haptics). Qurilma qo'llamasa yoki tizim sozlamasida o'chiq bo'lsa — hech narsa.
 * Faqat ma'noli joylarda: uzun bosish menyusi, tab almashish, yuborish, xato.
 */
const options = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

const safe = (type: 'impactLight' | 'impactMedium' | 'selection' | 'notificationSuccess' | 'notificationError') => () => {
  try {
    trigger(type, options);
  } catch {
    // Native modul yo'q (masalan, eski build) — jim.
  }
};

export const haptics = {
  light:     safe('impactLight'),
  medium:    safe('impactMedium'),
  selection: safe('selection'),
  success:   safe('notificationSuccess'),
  error:     safe('notificationError'),
} as const;
