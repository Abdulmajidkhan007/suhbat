import { Pressable, StyleSheet } from 'react-native';
import { HIT } from '../theme/metrics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

interface Props {
  icon:      IconName;
  /** Ekran o'quvchi uchun (majburiy — ikonkada matn yo'q). */
  label:     string;
  onPress:   () => void;
  color?:    string;
  size?:     number;
  disabled?: boolean;
  testID?:   string;
}

export const IconButton = ({ icon, label, onPress, color, size = 24, disabled = false, testID }: Props) => {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={{ color: palette.surfaceHighlight, borderless: true, radius: HIT / 2 }}
      style={({ pressed }) => [styles.root, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon name={icon} size={size} color={color ?? palette.primary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root:     { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pressed:  { opacity: 0.6 },
});
