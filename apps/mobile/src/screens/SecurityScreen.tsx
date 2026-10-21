import { ApiError } from '@suhbat/client';
import { PASSWORD_MAX, PASSWORD_MIN, RECOVERY_CODE_COUNT } from '@suhbat/core';
import type { RecoveryCodesStatus } from '@suhbat/core';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { RecoveryCodesCard } from '../components/RecoveryCodesCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';

type Message = { text: string; ok: boolean } | null;

const failure = (e: unknown) =>
  t(e instanceof ApiError && e.status === 400 ? 'security.wrongPassword' : 'security.error');

/** Sozlamalar → Xavfsizlik: tiklash kodlari (holat, qayta yaratish) va parolni o'zgartirish. */
export const SecurityScreen = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { services: { api } } = useSession();
  const { back } = useNavigation();

  const [status, setStatus] = useState<RecoveryCodesStatus | null>(null);
  const [codesPassword, setCodesPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesBusy, setCodesBusy] = useState(false);
  const [codesMessage, setCodesMessage] = useState<Message>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<Message>(null);

  const load = useCallback(() => {
    api.getRecoveryCodesStatus().then(setStatus, () => undefined);
  }, [api]);
  useEffect(load, [load]);

  const generate = async () => {
    setCodesBusy(true);
    setCodesMessage(null);
    try {
      setCodes(await api.regenerateRecoveryCodes(codesPassword));
      setCodesPassword('');
      load();
    } catch (e) {
      setCodesMessage({ text: failure(e), ok: false });
    } finally {
      setCodesBusy(false);
    }
  };

  const pwError = next.length > 0 && next.length < PASSWORD_MIN
    ? t('security.tooShort', { n: PASSWORD_MIN })
    : confirm.length > 0 && confirm !== next ? t('security.mismatch') : null;
  const canChange = current.length > 0 && next.length >= PASSWORD_MIN && next === confirm && !pwBusy;

  const changePassword = async () => {
    setPwBusy(true);
    setPwMessage(null);
    try {
      await api.changePassword(current, next);
      haptics.success();
      setCurrent('');
      setNext('');
      setConfirm('');
      setPwMessage({ text: t('security.changed'), ok: true });
    } catch (e) {
      setPwMessage({ text: failure(e), ok: false });
    } finally {
      setPwBusy(false);
    }
  };

  const statusText = status === null
    ? t('common.loading')
    : !status.generatedAt
      ? t('security.codesNone')
      : t('security.codesLeft', { n: status.remaining, total: RECOVERY_CODE_COUNT });
  const low = status !== null && status.generatedAt !== null && status.remaining <= 2;

  const passwordInput = (value: string, onChange: (v: string) => void, label: string, autoComplete: 'current-password' | 'new-password') => (
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
      <ScreenHeader title={t('security.title')} onBack={back} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{t('security.codes')}</Text>
          {codes ? (
            <RecoveryCodesCard codes={codes} doneLabel={t('common.done')} onDone={() => setCodes(null)} />
          ) : (
            <>
              <Text style={[styles.hint, low && styles.warn]}>{low ? t('security.codesLow') : statusText}</Text>
              <Text style={styles.hint}>{t('security.regenerateHint')}</Text>
              {passwordInput(codesPassword, setCodesPassword, t('security.currentPassword'), 'current-password')}
              {codesMessage ? <Text style={codesMessage.ok ? styles.ok : styles.error} accessibilityRole="alert">{codesMessage.text}</Text> : null}
              <PrimaryButton
                label={t('security.generate')}
                onPress={() => void generate()}
                disabled={codesPassword.length === 0}
                loading={codesBusy}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">{t('security.changePassword')}</Text>
          {passwordInput(current, setCurrent, t('security.currentPassword'), 'current-password')}
          {passwordInput(next, setNext, t('security.newPassword'), 'new-password')}
          {passwordInput(confirm, setConfirm, t('security.confirmPassword'), 'new-password')}
          {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
          <Text style={styles.hint}>{t('security.changeHint')}</Text>
          {pwMessage ? <Text style={pwMessage.ok ? styles.ok : styles.error} accessibilityRole="alert">{pwMessage.text}</Text> : null}
          <PrimaryButton label={t('security.changePassword')} onPress={() => void changePassword()} disabled={!canChange} loading={pwBusy} />
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: p.background },
  body:    { padding: space.lg, gap: space.lg },
  card:    { backgroundColor: p.surface, borderRadius: radii.md, padding: space.lg, gap: space.sm },
  heading: { ...textStyles.body, fontWeight: '600', color: p.textPrimary },
  hint:    { ...textStyles.bodySmall, color: p.textSecondary },
  warn:    { color: p.danger },
  input:   {
    ...textStyles.body, fontSize: 16, color: p.textPrimary, backgroundColor: p.surfaceHighlight,
    borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.sm + 4,
  },
  error:   { ...textStyles.bodySmall, color: p.danger },
  ok:      { ...textStyles.bodySmall, color: p.success },
});
