import type { Palette } from '@suhbat/ui-tokens';
import { fontSize } from '@suhbat/ui-tokens';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';

interface Props {
  label:   string;
  onPress: () => void;
  danger?: boolean;
}

export const HeaderButton = ({ label, onPress, danger = false }: Props) => {
  const styles = useStyles(createStyles);
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.text, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  text:   { color: p.primary, fontSize: fontSize.md, fontWeight: '600' },
  danger: { color: p.danger },
});
