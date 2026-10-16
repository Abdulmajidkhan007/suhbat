import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { useConnection } from '../state/useConnection';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

/** Server bilan aloqa uzilganda: "Ulanmoqda…" (xabarlar navbatda, qayta ulanganda yangilanadi). */
export const ConnectionBanner = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const status = useConnection();
  if (status === 'online') return null;
  return (
    <View style={styles.root} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={palette.textSecondary} />
      <Text style={styles.text}>{t('conn.connecting')}</Text>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.xs, backgroundColor: p.surfaceHighlight },
  text: { ...textStyles.bodySmall, color: p.textSecondary },
});
