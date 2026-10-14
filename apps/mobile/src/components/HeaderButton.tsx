import type { Palette } from '@suhbat/ui-tokens';
import { fontSize } from '@suhbat/ui-tokens';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';

interface Props {
  label:   string;
  onPress: () => void;
  danger?: boolean;
  /** Ikonka (emoji) bo'lsa — ekran o'quvchi uchun matn. */
  accessibilityLabel?: string;
  disabled?: boolean;
}

export const HeaderButton = ({ label, onPress, danger = false, accessibilityLabel, disabled = false }: Props) => {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, danger && styles.danger, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  text:   { color: p.primary, fontSize: fontSize.md, fontWeight: '600' },
  danger: { color: p.danger },
  disabled: { opacity: 0.4 },
});
