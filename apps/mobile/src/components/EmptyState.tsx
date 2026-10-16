import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

interface Props {
  icon?:    IconName;
  title:    string;
  body?:    string;
  /** Xato holati — ikonka qizil, "Qayta urinish" tugmasi. */
  error?:   boolean;
  onRetry?: () => void;
  actionLabel?: string;
  /** Inverted FlatList ichida — teskari aylantirib qo'yiladi. */
  inverted?: boolean;
}

export const EmptyState = ({ icon = 'chatbubbles-outline', title, body, error = false, onRetry, actionLabel, inverted = false }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  return (
    <View style={[styles.root, inverted && styles.inverted]} accessibilityRole={error ? 'alert' : undefined}>
      <View style={[styles.iconWrap, error && styles.iconWrapError]}>
        <Icon name={error ? 'cloud-offline-outline' : icon} size={40} color={error ? palette.danger : palette.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>{actionLabel ?? t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** Butun ekran yuklanmoqda. */
export const LoadingState = () => {
  const { palette } = useTheme();
  return (
    <View style={loadingStyles.root}>
      <ActivityIndicator color={palette.primary} size="large" accessibilityLabel={t('common.loading')} />
    </View>
  );
};

const loadingStyles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl } });

const createStyles = (p: Palette) => StyleSheet.create({
  root:          { alignItems: 'center', justifyContent: 'center', padding: space.xxxl, gap: space.md },
  inverted:      { transform: [{ scaleY: -1 }] },
  iconWrap:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surfaceHighlight },
  iconWrapError: { backgroundColor: p.surfaceHighlight },
  title:         { ...textStyles.heading, color: p.textPrimary, textAlign: 'center' },
  body:          { ...textStyles.body, color: p.textSecondary, textAlign: 'center' },
  button:        { marginTop: space.sm, paddingHorizontal: space.xxl, paddingVertical: space.md, borderRadius: radii.full, backgroundColor: p.primary },
  buttonText:    { ...textStyles.button, color: p.onPrimary },
});
