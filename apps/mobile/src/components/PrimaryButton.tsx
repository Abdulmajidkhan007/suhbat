import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

interface Props {
  label:     string;
  onPress:   () => void;
  disabled?: boolean;
  loading?:  boolean;
  /** Tugma matni ko'rinadigan label'dan farq qilsa (masalan, "Qo'shish (2)"). */
  accessibilityLabel?: string;
}

export const PrimaryButton = ({ label, onPress, disabled = false, loading = false, accessibilityLabel }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [styles.root, off && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={palette.onPrimary} /> : <Text style={styles.text}>{label}</Text>}
    </Pressable>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:     { minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, backgroundColor: p.primary },
  disabled: { opacity: 0.45 },
  pressed:  { opacity: 0.8 },
  text:     { ...textStyles.button, color: p.onPrimary },
});
