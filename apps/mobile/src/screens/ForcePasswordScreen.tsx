import { ApiError } from '@suhbat/client';
import { PASSWORD_MAX, PASSWORD_MIN } from '@suhbat/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { t } from '../i18n';
import { useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';

/**
 * Admin vaqtinchalik parol bergan (`mustChangePassword`): yangi parol o'rnatilmaguncha ilovaning
 * qolgan qismi ochilmaydi (server ham boshqa so'rovlarni 403 bilan rad etadi).
 */
export const ForcePasswordScreen = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { services: { api }, updateUser, logout } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < PASSWORD_MIN;
  const canSave = current.length > 0 && next.length >= PASSWORD_MIN && next === confirm && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await api.changePassword(current, next);
      haptics.success();
      updateUser(user);
    } catch (e) {
      setError(t(e instanceof ApiError && e.status === 400 ? 'force.wrongTemp' : 'security.error'));
    } finally {
      setBusy(false);
    }
  };

  const input = (value: string, onChange: (v: string) => void, label: string, autoComplete: 'current-password' | 'new-password') => (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      secureTextEntry
      autoCapitalize="none"
      autoComplete={autoComplete}
      maxLength={PASSWORD_MAX}
      placeholder={label}
      placeholderTextColor={palette.textDisabled}
      accessibilityLabel={label}
    />
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">{t('force.title')}</Text>
        <Text style={styles.hint}>{t('force.hint')}</Text>
        <View style={styles.card}>
          {input(current, setCurrent, t('force.tempPassword'), 'current-password')}
          {input(next, setNext, t('security.newPassword'), 'new-password')}
          {input(confirm, setConfirm, t('security.confirmPassword'), 'new-password')}
          {tooShort ? <Text style={styles.error}>{t('security.tooShort', { n: PASSWORD_MIN })}</Text> : null}
          {mismatch ? <Text style={styles.error}>{t('security.mismatch')}</Text> : null}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Text style={styles.hint}>{t('security.changeHint')}</Text>
          <PrimaryButton label={t('force.save')} onPress={() => void save()} disabled={!canSave} loading={busy} />
        </View>
        <PrimaryButton label={t('settings.logout')} onPress={() => void logout()} disabled={busy} />
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:  { flex: 1, backgroundColor: p.background },
  body:  { padding: space.lg, gap: space.lg },
  title: { ...textStyles.body, fontSize: 22, fontWeight: '700', color: p.textPrimary },
  hint:  { ...textStyles.bodySmall, color: p.textSecondary },
  card:  { backgroundColor: p.surface, borderRadius: radii.md, padding: space.lg, gap: space.sm },
  input: {
    ...textStyles.body, fontSize: 16, color: p.textPrimary, backgroundColor: p.surfaceHighlight,
    borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.sm + 4,
  },
  error: { ...textStyles.bodySmall, color: p.danger },
});
