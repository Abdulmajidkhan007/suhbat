import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

/** Masofalar (px). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radii = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, bubble: 17, full: 9999 } as const;

/** Bosiladigan elementning eng kichik o'lchami (accessibility: 44–48 px). */
export const HIT = 44;

const shadow = (height: number, opacity: number, blur: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height }, shadowOpacity: opacity, shadowRadius: blur },
    android: { elevation },
    default: {},
  });

export const shadows = {
  sm: shadow(1, 0.08, 2, 2),
  md: shadow(2, 0.12, 6, 4),
  lg: shadow(4, 0.16, 12, 8),
} as const;
