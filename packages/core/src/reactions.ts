import { REACTION_EMOJIS } from './schemas.js';
import type { MessageReaction, ReactionEmoji } from './schemas.js';

/**
 * Optimistik yangilash: o'zining reaksiyasi `prev` dan `next` ga o'tganda yangi hisob
 * (serverdagi bilan bir xil mantiq: bir foydalanuvchi — bitta reaksiya; natija `REACTION_EMOJIS`
 * tartibida, soni 0 bo'lgan emoji chiqmaydi).
 */
export const applyMyReaction = (
  reactions: readonly MessageReaction[],
  prev: ReactionEmoji | null | undefined,
  next: ReactionEmoji | null,
): MessageReaction[] => {
  const counts = new Map<ReactionEmoji, number>(reactions.map((r) => [r.emoji, r.count]));
  if (prev) counts.set(prev, Math.max(0, (counts.get(prev) ?? 0) - 1));
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  return REACTION_EMOJIS.filter((e) => (counts.get(e) ?? 0) > 0).map((emoji) => ({ emoji, count: counts.get(emoji)! }));
};

/** Bosilganda yuboriladigan qiymat: o'zining reaksiyasini yana bosish — olib tashlash. */
export const toggleReaction = (current: ReactionEmoji | null | undefined, picked: ReactionEmoji): ReactionEmoji | null =>
  current === picked ? null : picked;
