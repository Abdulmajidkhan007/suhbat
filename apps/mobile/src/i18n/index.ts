import { uz } from './uz';
import type { MessageKey } from './uz';

export type { MessageKey } from './uz';
export type Params = Readonly<Record<string, string | number>>;

/** Hozircha bitta til; tanlash qo'shilganda shu yerda lug'at almashtiriladi. */
const dict: Readonly<Record<MessageKey, string>> = uz;

/** Tarjima: `t('chat.members', { n: 5 })` → "5 a'zo". Kalit tipi tekshiriladi. */
export const t = (key: MessageKey, params?: Params): string => {
  const text = dict[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (params[name] !== undefined ? String(params[name]) : m));
};
