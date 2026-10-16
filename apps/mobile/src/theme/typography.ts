import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

export const fontSizes = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 30 } as const;

export const fontWeights = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

export const textStyles = {
  title:         { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold },
  heading:       { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold },
  body:          { fontSize: fontSizes.md, fontWeight: fontWeights.regular },
  bodySmall:     { fontSize: fontSizes.sm, fontWeight: fontWeights.regular },
  caption:       { fontSize: fontSizes.xs, fontWeight: fontWeights.regular },
  /** Bo'lim sarlavhasi (sozlamalar, qidiruv). */
  section:       { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  chatName:      { fontSize: fontSizes.md + 1, fontWeight: fontWeights.semibold },
  chatPreview:   { fontSize: fontSizes.md, fontWeight: fontWeights.regular },
  chatTime:      { fontSize: fontSizes.sm, fontWeight: fontWeights.regular },
  message:       { fontSize: fontSizes.md + 1, lineHeight: 22 },
  messageMeta:   { fontSize: fontSizes.xs + 1, fontVariant: ['tabular-nums'] },
  button:        { fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
} as const satisfies Record<string, TextStyle>;

/** Raqamlar bir xil kenglikda (taymer, vaqt). */
export const monoDigits: TextStyle = Platform.select({ default: { fontVariant: ['tabular-nums'] } });
