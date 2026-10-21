import { ApiError } from '@suhbat/client';
import { normalizeRecoveryCode, PASSWORD_MAX, PASSWORD_MIN } from '@suhbat/core';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSession } from '../state/SessionProvider';
import { radii, shadows, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

const failureText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'Login yoki tiklash kodi noto\'g\'ri (har bir kod faqat bir marta ishlaydi).';
    if (e.status === 429) return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
    if (e.status === 0) return e.message;
  }
  return 'Parolni tiklab bo\'lmadi. Qayta urinib ko\'ring.';
};

/** Emailsiz tiklash: login + ro'yxatdan o'tishda saqlangan bir martalik kod + yangi parol. */
export const RecoverWithCodeScreen = ({ onBack, initialLogin = '' }: { onBack: () => void; initialLogin?: string }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { services: { api } } = useSession();
  const [login, setLogin] = useState(initialLogin);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const submit = async () => {
    if (!login.trim()) return setError('Email yoki username kiriting');
    if (!normalizeRecoveryCode(code)) return setError('Kod ko\'rinishi: XXXX-XXXX-XXXX (12 belgi)');
    if (password.length < PASSWORD_MIN) return setError(`Parol kamida ${PASSWORD_MIN} belgi bo'lsin`);
    if (password !== confirm) return setError('Parollar mos emas');
    setBusy(true);
    setError(null);
    try {
      await api.recoverWithCode(login.trim(), code.trim(), password);
      setDone(true);
    } catch (e) {
      setError(failureText(e));
    } finally {
      setBusy(false);
    }
  };

  const input = (props: React.ComponentProps<typeof TextInput>) => (
    <TextInput style={styles.input} placeholderTextColor={palette.textDisabled} autoCapitalize="none" autoCorrect={false}
      editable={!busy} {...props} />
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">Tiklash kodi bilan</Text>
          {done ? (
            <Text style={styles.ok} accessibilityRole="alert">
              Yangi parol o'rnatildi, ishlatilgan kod endi yaroqsiz. Barcha qurilmalardan chiqildi — yangi parol bilan kiring.
            </Text>
          ) : (
            <>
              <Text style={styles.hint}>Ro'yxatdan o'tishda saqlagan kodlaringizdan birini kiriting. Email kerak emas.</Text>
              {input({ value: login, onChangeText: setLogin, placeholder: 'Email yoki username', autoComplete: 'username', accessibilityLabel: 'Email yoki username' })}
              {input({
                value: code, onChangeText: setCode, placeholder: 'XXXX-XXXX-XXXX', autoCapitalize: 'characters', maxLength: 32,
                accessibilityLabel: 'Tiklash kodi', style: [styles.input, styles.mono],
              })}
              {input({ value: password, onChangeText: setPassword, placeholder: 'Yangi parol', secureTextEntry: true, autoComplete: 'new-password', maxLength: PASSWORD_MAX, accessibilityLabel: 'Yangi parol' })}
              {input({ value: confirm, onChangeText: setConfirm, placeholder: 'Parolni tasdiqlang', secureTextEntry: true, autoComplete: 'new-password', maxLength: PASSWORD_MAX, accessibilityLabel: 'Parolni tasdiqlang', onSubmitEditing: submit })}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Parolni tiklash</Text>}
              </Pressable>
            </>
          )}
          <Pressable onPress={onBack} disabled={busy} accessibilityRole="button">
            <Text style={styles.link}>Kirish sahifasiga qaytish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: p.background },
  content:    { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  card:       { ...shadows.sm, width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.md, padding: space.xxl, borderRadius: radii.xl, backgroundColor: p.surface },
  title:      { ...textStyles.title, color: p.textPrimary, textAlign: 'center' },
  hint:       { ...textStyles.bodySmall, color: p.textSecondary, textAlign: 'center' },
  input:      { ...textStyles.body, fontSize: 16, borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.md, color: p.textPrimary, backgroundColor: p.surfaceHighlight },
  mono:       { fontFamily: 'monospace', letterSpacing: 1 },
  error:      { ...textStyles.bodySmall, color: p.danger },
  ok:         { ...textStyles.body, color: p.success, textAlign: 'center' },
  button:     { minHeight: 48, backgroundColor: p.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  buttonBusy: { opacity: 0.7 },
  buttonText: { ...textStyles.button, color: p.onPrimary },
  link:       { ...textStyles.bodySmall, color: p.primary, textAlign: 'center', paddingVertical: space.xs },
});
