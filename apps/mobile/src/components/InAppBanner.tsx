import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { radii, shadows, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';

interface Props {
  title:     string;
  body:      string;
  onPress:   () => void;
  onDismiss: () => void;
}

/** Ilova ochiq paytda kelgan bildirishnoma — ekran tepasida, bosilsa chat ochiladi. */
export const InAppBanner = ({ title, body, onPress, onDismiss }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Yangi xabar: ${title}`}
        accessibilityHint="Chatni ochadi"
      >
        <Avatar name={title} size={40} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        </View>
        <IconButton icon="close" label={t('common.close')} onPress={onDismiss} color={palette.textSecondary} size={20} />
      </Pressable>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, padding: space.sm, zIndex: 5 },
  card: {
    ...shadows.lg,
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, paddingVertical: space.sm,
    borderRadius: radii.lg, backgroundColor: p.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: p.divider,
  },
  texts: { flex: 1 },
  title: { ...textStyles.body, fontWeight: '600', color: p.textPrimary },
  body:  { ...textStyles.bodySmall, color: p.textSecondary, marginTop: 2 },
});
