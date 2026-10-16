import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { avatarColor, initials } from '../utils/format';
import { Icon } from './icon/Icon';
import type { IconName } from './icon/Icon';

interface Props {
  name:    string;
  /** Rang shu qiymatdan (odatda id) — ism o'zgarsa ham rang o'zgarmaydi. */
  seed?:   string;
  online?: boolean;
  size?:   number;
  /** Harflar o'rniga ikonka (masalan, kanal). */
  icon?:   IconName;
}

export const Avatar = memo(({ name, seed, online = false, size = 52, icon }: Props) => {
  const styles = useStyles(createStyles);
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(seed ?? name) }]}>
        {icon ? (
          <Icon name={icon} size={size * 0.5} color="#FFFFFF" />
        ) : (
          <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]} numberOfLines={1}>{initials(name)}</Text>
        )}
      </View>
      {online ? (
        <View
          testID="online-dot"
          style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, borderWidth: Math.max(2, size * 0.04) }]}
        />
      ) : null}
    </View>
  );
});

const createStyles = (p: Palette) => StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text:   { color: '#FFFFFF', fontWeight: '600' },
  dot:    { position: 'absolute', right: 0, bottom: 0, backgroundColor: p.online, borderColor: p.surface },
});
