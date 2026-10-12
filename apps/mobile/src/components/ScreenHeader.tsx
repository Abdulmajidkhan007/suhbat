import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, spacing } from '@suhbat/ui-tokens';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';

interface Props {
  title:     string;
  subtitle?: string;
  onBack?:   () => void;
  right?:    ReactNode;
}

export const ScreenHeader = ({ title, subtitle, onBack, right }: Props) => {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.root}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Orqaga">
          <Text style={styles.back}>‹</Text>
        </Pressable>
      )}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: spacing(3),
    paddingHorizontal: spacing(4), paddingVertical: spacing(3),
    backgroundColor: p.surface, borderBottomWidth: 1, borderBottomColor: p.divider,
  },
  back:     { fontSize: 32, lineHeight: 32, color: p.primary },
  titles:   { flex: 1 },
  title:    { fontSize: fontSize.lg, fontWeight: '700', color: p.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: p.textSecondary },
});
