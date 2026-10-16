import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { IconButton } from './IconButton';

interface Props {
  title:         string;
  subtitle?:     string;
  /** Subtitle rangi asosiy rangda (onlayn / yozmoqda). */
  subtitleAccent?: boolean;
  onBack?:       () => void;
  /** Sarlavha oldidagi element (masalan, avatar). */
  left?:         ReactNode;
  right?:        ReactNode;
  /** Sarlavhani bosish (masalan, chat ma'lumotlari). */
  onTitlePress?: () => void;
  titleHint?:    string;
  /** Katta sarlavha (tab ekranlari). */
  large?:        boolean;
}

export const ScreenHeader = ({
  title, subtitle, subtitleAccent = false, onBack, left, right, onTitlePress, titleHint, large = false,
}: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const titles = (
    <View style={styles.titles}>
      <Text style={large ? styles.large : styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, subtitleAccent && styles.subtitleAccent]} numberOfLines={1}>{subtitle}</Text>
      ) : null}
    </View>
  );
  return (
    <View style={[styles.root, !onBack && styles.rootNoBack]}>
      {onBack ? <IconButton icon="chevron-back" label={t('common.back')} onPress={onBack} size={26} color={palette.primary} /> : null}
      {onTitlePress ? (
        <Pressable
          style={styles.titleArea}
          onPress={onTitlePress}
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
          accessibilityHint={titleHint}
        >
          {left}
          {titles}
        </Pressable>
      ) : (
        <View style={styles.titleArea}>
          {left}
          {titles}
        </View>
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56,
    paddingHorizontal: space.xs, backgroundColor: p.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.divider,
  },
  rootNoBack:     { paddingLeft: space.lg },
  titleArea:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  titles:         { flex: 1 },
  title:          { ...textStyles.heading, color: p.textPrimary },
  large:          { ...textStyles.title, color: p.textPrimary },
  subtitle:       { ...textStyles.bodySmall, color: p.textSecondary },
  subtitleAccent: { color: p.primary },
  right:          { flexDirection: 'row', alignItems: 'center' },
});
