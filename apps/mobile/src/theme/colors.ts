import type { ColorScheme, Palette as BasePalette } from '@suhbat/ui-tokens';

/**
 * Mobil palitra ("Pulse UI" uslubi). `@suhbat/ui-tokens` dagi umumiy kalitlarning ustiga
 * mobil ekranlar uchun qo'shimchalar — shuning uchun umumiy `Palette` kutgan joyga ham mos keladi.
 */
export interface Palette extends BasePalette {
  /** Asosiy rang ustidagi matn/ikonka. */
  onPrimary:        string;
  surfaceElevated:  string;
  /** Bosilgan qator, qidiruv maydoni foni. */
  surfaceHighlight: string;
  /** Chat ekrani foni (pufaklar ortida). */
  chatBackground:   string;
  bubbleOtherText:  string;
  /** Pufak ichidagi vaqt va holat belgisi. */
  bubbleOwnMeta:    string;
  bubbleOtherMeta:  string;
  /** O'qildi (✓✓) belgisi o'z pufagida. */
  readTick:         string;
  link:             string;
  success:          string;
  warning:          string;
  overlay:          string;
  tabBar:           string;
  tabBarInactive:   string;
  unreadBadge:      string;
  /** Ovozsiz/ikkinchi darajali belgi foni (masalan, rol yorlig'i). */
  chip:             string;
}

const light: Palette = {
  primary:          '#3390EC',
  primaryDark:      '#2878C9',
  primaryLight:     '#6DB1F5',
  secondary:        '#2E9E5B',
  onPrimary:        '#FFFFFF',
  background:       '#F1F2F6',
  surface:          '#FFFFFF',
  surfaceElevated:  '#FFFFFF',
  surfaceHighlight: '#EDEFF2',
  chatBackground:   '#DCE8D2',
  divider:          '#E4E6EA',
  textPrimary:      '#000000',
  textSecondary:    '#707579',
  textDisabled:     '#A2A6AB',
  bubbleOwn:        '#E3FEE0',
  bubbleOwnText:    '#000000',
  bubbleOwnMeta:    '#4FAE4E',
  bubbleOther:      '#FFFFFF',
  bubbleOtherText:  '#000000',
  bubbleOtherMeta:  '#A2A6AB',
  readTick:         '#4FAE4E',
  link:             '#2B7BE0',
  danger:           '#D32F2F',
  success:          '#2E9E5B',
  warning:          '#F57C00',
  online:           '#2E9E5B',
  overlay:          'rgba(0,0,0,0.4)',
  tabBar:           '#FFFFFF',
  tabBarInactive:   '#8A8F94',
  unreadBadge:      '#3390EC',
  chip:             '#EDEFF2',
};

const dark: Palette = {
  primary:          '#4FA3E3',
  primaryDark:      '#3A8AC9',
  primaryLight:     '#7BBDF0',
  secondary:        '#4CAF80',
  onPrimary:        '#FFFFFF',
  background:       '#151E27',
  surface:          '#1E2832',
  surfaceElevated:  '#24303C',
  surfaceHighlight: '#2C3A48',
  chatBackground:   '#0E1621',
  divider:          '#2A3643',
  textPrimary:      '#FFFFFF',
  textSecondary:    '#8394A6',
  textDisabled:     '#5E6E7E',
  bubbleOwn:        '#2B5278',
  bubbleOwnText:    '#FFFFFF',
  bubbleOwnMeta:    'rgba(255,255,255,0.6)',
  bubbleOther:      '#1E2832',
  bubbleOtherText:  '#FFFFFF',
  bubbleOtherMeta:  '#7D8B99',
  readTick:         '#7BBDF0',
  link:             '#6BBCFF',
  danger:           '#FF5252',
  success:          '#4CAF80',
  warning:          '#FFC107',
  online:           '#4CAF80',
  overlay:          'rgba(0,0,0,0.6)',
  tabBar:           '#1E2832',
  tabBarInactive:   '#7D8B99',
  unreadBadge:      '#4FA3E3',
  chip:             '#2C3A48',
};

export const basePalettes: Readonly<Record<ColorScheme, Palette>> = { light, dark };

/** Avatar ranglari (Telegram'dagi kabi — id bo'yicha barqaror tanlanadi). */
export const AVATAR_COLORS = ['#E17076', '#F5A142', '#A695E7', '#7BC862', '#6EC9CB', '#65AADD', '#EE7AAE'] as const;
