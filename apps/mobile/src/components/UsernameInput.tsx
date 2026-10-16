import { USERNAME_MAX } from '@suhbat/core';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { usernameHint } from '../hooks/useUsernameCheck';
import type { UsernameCheck } from '../hooks/useUsernameCheck';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

interface Props {
  value:     string;
  onChange:  (v: string) => void;
  check:     UsernameCheck;
  optional?: boolean;
  editable?: boolean;
  /** Ekranning o'z input uslubi (ramka, fon) — maydon shu ekrandagilar bilan bir xil ko'rinadi. */
  inputStyle?: StyleProp<TextStyle>;
}

/** `@` prefiksli username maydoni va jonli tekshiruv izohi. */
export const UsernameInput = ({ value, onChange, check, optional = false, editable = true, inputStyle }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const bad = check.status === 'invalid' || check.status === 'taken';
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={[inputStyle, styles.input]}
          value={value}
          onChangeText={onChange}
          placeholder="username"
          placeholderTextColor={palette.textDisabled}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={USERNAME_MAX + 1}
          editable={editable}
          accessibilityLabel="Username"
        />
      </View>
      <Text style={[styles.hint, bad && styles.bad, check.status === 'available' && styles.ok]}>{usernameHint(check, optional)}</Text>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:  { gap: space.xs },
  row:   { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  at:    { ...textStyles.body, fontSize: 16, color: p.textSecondary, fontWeight: '700' },
  input: { flex: 1, borderRadius: radii.md },
  hint:  { ...textStyles.caption, fontSize: 12, color: p.textSecondary },
  bad:   { color: p.danger },
  ok:    { color: p.success },
});
