import type { ColorScheme } from '@suhbat/ui-tokens';
import type { Palette } from './colors';

export type AccentKey = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal' | 'pink';

interface Accent {
  label:       string;
  dark:        string;
  light:       string;
  /** O'z xabarimiz pufagi. */
  bubbleDark:  string;
  bubbleLight: string;
}

export const ACCENTS: Readonly<Record<AccentKey, Accent>> = {
  blue:   { label: 'Ko\'k',      dark: '#4FA3E3', light: '#3390EC', bubbleDark: '#2B5278', bubbleLight: '#E3FEE0' },
  green:  { label: 'Yashil',     dark: '#5DBB6B', light: '#3FA84F', bubbleDark: '#2E5A3A', bubbleLight: '#DCF8C6' },
  orange: { label: 'To\'q sariq', dark: '#F0A04B', light: '#E68A1E', bubbleDark: '#6B4A23', bubbleLight: '#FFF0D9' },
  red:    { label: 'Qizil',      dark: '#E86B6B', light: '#E0484E', bubbleDark: '#6A2E33', bubbleLight: '#FFE1E1' },
  purple: { label: 'Binafsha',   dark: '#A07CE8', light: '#8A5CDB', bubbleDark: '#4A3A72', bubbleLight: '#EDE3FF' },
  teal:   { label: 'Feruza',     dark: '#3CC2C2', light: '#1BA5A8', bubbleDark: '#1F5A5D', bubbleLight: '#D9F7F5' },
  pink:   { label: 'Pushti',     dark: '#E86FA8', light: '#D9488C', bubbleDark: '#6A2E4C', bubbleLight: '#FFE0EF' },
};

export const ACCENT_ORDER: readonly AccentKey[] = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'pink'];

export const isAccentKey = (v: unknown): v is AccentKey => typeof v === 'string' && v in ACCENTS;

/** Bazaviy palitraga tanlangan asosiy rangni qo'llaydi. */
export const applyAccent = (base: Palette, scheme: ColorScheme, key: AccentKey): Palette => {
  if (key === 'blue') return base;
  const a = ACCENTS[key];
  const main = scheme === 'dark' ? a.dark : a.light;
  return {
    ...base,
    primary:     main,
    primaryDark: main,
    unreadBadge: main,
    link:        main,
    bubbleOwn:   scheme === 'dark' ? a.bubbleDark : a.bubbleLight,
    // Yorug' rejimda o'z pufagidagi vaqt/belgi — asosiy rangda (yashil pufakda yashil edi).
    ...(scheme === 'light' ? { bubbleOwnMeta: main, readTick: main } : {}),
  };
};
