import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';

interface Props {
  title:     string;
  body:      string;
  onPress:   () => void;
  onDismiss: () => void;
}

/** Ilova ochiq paytda kelgan bildirishnoma — ekran tepasida, bosilsa chat ochiladi. */
export const InAppBanner = ({ title, body, onPress, onDismiss }: Props) => {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Yangi xabar: ${title}`}
        accessibilityHint="Chatni ochadi"
      >
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Yopish">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, padding: spacing(2) },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing(3),
    padding:         spacing(3),
    borderRadius:    radius.md,
    backgroundColor: p.surface,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     p.divider,
    elevation:       6,
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
  },
  texts: { flex: 1 },
  title: { color: p.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  body:  { color: p.textSecondary, fontSize: fontSize.sm, marginTop: spacing(0.5) },
  close: { color: p.textSecondary, fontSize: fontSize.md },
});
