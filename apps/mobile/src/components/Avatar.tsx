import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius } from '@suhbat/ui-tokens';
import { StyleSheet, Text, View } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';
import { initials } from '../utils/format';

interface Props {
  name:    string;
  online?: boolean;
  size?:   number;
}

export const Avatar = ({ name, online = false, size = 44 }: Props) => {
  const styles = useStyles(createStyles);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.text}>{initials(name)}</Text>
      </View>
      {online && <View style={styles.dot} accessibilityLabel="onlayn" />}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  circle: { backgroundColor: p.primaryLight, alignItems: 'center', justifyContent: 'center' },
  text:   { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },
  dot: {
    position: 'absolute', right: 0, bottom: 0, width: 12, height: 12,
    borderRadius: radius.full, backgroundColor: p.online, borderWidth: 2, borderColor: p.surface,
  },
});
