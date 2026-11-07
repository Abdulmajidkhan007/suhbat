// Faoliyat jurnali: turlar va chat turlarining o'zbekcha nomlari.
import type { ActivityChatKind, ActivityMediaKind, ActivityType } from '@suhbat/core';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  register:        'Ro\'yxatdan o\'tdi',
  login:           'Kirdi',
  login_failed:    'Kirish muvaffaqiyatsiz',
  logout:          'Chiqdi',
  password_change: 'Parolni o\'zgartirdi',
  chat_create:     'Chat yaratdi',
  group_join:      'Guruh/kanalga qo\'shildi',
  group_leave:     'Guruh/kanaldan chiqdi',
  channel_create:  'Kanal yaratdi',
  message_send:    'Xabar yubordi',
  media_upload:    'Fayl yukladi',
  message_delete:  'Xabar o\'chirdi',
  call_start:      'Qo\'ng\'iroq boshladi',
  call_end:        'Qo\'ng\'iroq tugadi',
  report:          'Shikoyat qildi',
};

export const CHAT_KIND_LABELS: Record<ActivityChatKind, string> = {
  private: 'Shaxsiy (1:1)',
  group:   'Guruh',
  channel: 'Kanal',
};

export const MEDIA_KIND_LABELS: Record<ActivityMediaKind, string> = {
  image: 'Rasm',
  video: 'Video',
  voice: 'Ovoz',
  file:  'Fayl',
};

export const activityLabel = (type: string): string => ACTIVITY_LABELS[type as ActivityType] ?? type;

/** Yozuv tafsiloti: faqat metadata (uzunlik, sabab, davomiylik) — matn emas. */
export const describeMeta = (m: { length?: number; hasAttachment?: boolean; reason?: string; durationMs?: number; callMedia?: string } | null): string => {
  if (!m) return '';
  const parts: string[] = [];
  if (m.length !== undefined) parts.push(`${m.length} belgi`);
  if (m.hasAttachment) parts.push('biriktirma bilan');
  if (m.callMedia) parts.push(m.callMedia === 'video' ? 'video' : 'audio');
  if (m.durationMs) parts.push(`${Math.round(m.durationMs / 1000)} s`);
  if (m.reason) parts.push(m.reason);
  return parts.join(' · ');
};
