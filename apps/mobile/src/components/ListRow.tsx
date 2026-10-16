import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

interface Props {
  title:        string;
  subtitle?:    string;
  /** O'ngdagi qiymat (masalan, tanlangan rejim). */
  value?:       string;
  icon?:        IconName;
  /** Ikonka fonining rangi (sozlamalardagi rangli kvadrat). */
  iconColor?:   string;
  left?:        ReactNode;
  right?:       ReactNode;
  onPress?:     () => void;
  onLongPress?: () => void;
  chevron?:     boolean;
  destructive?: boolean;
  selected?:    boolean;
  accessibilityLabel?: string;
  accessibilityHint?:  string;
  /** `checkbox` / `radio` — tanlov ro'yxatlari uchun. */
  role?:        'button' | 'checkbox' | 'radio';
}

/** Sozlamalar, a'zolar, qidiruv natijalari uchun umumiy qator. */
export const ListRow = ({
  title, subtitle, value, icon, iconColor, left, right, onPress, onLongPress, chevron = false,
  destructive = false, selected, accessibilityLabel, accessibilityHint, role = 'button',
}: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const tint = destructive ? palette.danger : palette.textPrimary;
  const state = role === 'button' ? undefined : role === 'checkbox' ? { checked: selected } : { selected };
  const content = (
    <>
      {left}
      {icon ? (
        iconColor ? (
          <View style={[styles.iconBox, { backgroundColor: iconColor }]}><Icon name={icon} size={18} color="#FFFFFF" /></View>
        ) : (
          <Icon name={icon} size={24} color={destructive ? palette.danger : palette.textSecondary} />
        )
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, { color: tint }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {chevron ? <Icon name="chevron-forward" size={18} color={palette.textDisabled} /> : null}
    </>
  );
  // Bosilmaydigan qator — oddiy View (aks holda ekran o'quvchi uni "o'chiq tugma" deb o'qiydi).
  if (!onPress && !onLongPress) {
    return <View style={styles.root} accessibilityLabel={accessibilityLabel}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={role}
      accessibilityState={state}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: palette.surfaceHighlight }}
      style={({ pressed }) => [styles.root, (pressed || selected) && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52,
    paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: p.surface,
  },
  pressed:  { backgroundColor: p.surfaceHighlight },
  iconBox:  { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  body:     { flex: 1, gap: 2 },
  title:    { ...textStyles.body, fontSize: 16 },
  subtitle: { ...textStyles.bodySmall, color: p.textSecondary },
  value:    { ...textStyles.bodySmall, color: p.textSecondary, maxWidth: '40%' },
});
