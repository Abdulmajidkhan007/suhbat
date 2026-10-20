import { ApiError } from '@suhbat/client';
import { LoginInputSchema, normalizeUsername, RegisterInputSchema } from '@suhbat/core';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { UsernameInput } from '../components/UsernameInput';
import { usernameAcceptable, useUsernameCheck } from '../hooks/useUsernameCheck';
import { useSession } from '../state/SessionProvider';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { RecoverWithCodeScreen } from './RecoverWithCodeScreen';
import { Icon } from '../components/icon/Icon';
import { radii, shadows, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

type Mode = 'login' | 'register';

const errorText = (e: unknown): string =>
  e instanceof ApiError ? e.message : 'Kutilmagan xato. Qayta urinib ko\'ring.';

type Flow = { step: 'form' } | { step: 'forgot' | 'recover'; value: string };

/** Kirish/ro'yxatdan o'tish, "Parolni unutdim" (email) va tiklash kodi bilan (tizimga kirmagan holat). */
export const AuthScreen = ({ expired = false }: { expired?: boolean }) => {
  const [flow, setFlow] = useState<Flow>({ step: 'form' });
  const toForm = useCallback(() => setFlow({ step: 'form' }), []);
  if (flow.step === 'recover') return <RecoverWithCodeScreen onBack={toForm} initialLogin={flow.value} />;
  if (flow.step === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={toForm}
        onRecoverWithCode={(value) => setFlow({ step: 'recover', value })}
        initialValue={flow.value}
      />
    );
  }
  return <AuthForm expired={expired} onForgot={(value) => setFlow({ step: 'forgot', value })} />;
};

const AuthForm = ({ expired, onForgot }: { expired: boolean; onForgot: (value: string) => void }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { login, register } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const usernameCheck = useUsernameCheck(mode === 'register' ? username : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(expired ? 'Sessiya tugadi. Qayta kiring.' : null);

  const invalid = () => {
    setError(mode === 'register' && password.length < 8
      ? 'Parol kamida 8 belgi bo\'lsin'
      : 'Ma\'lumotlarni to\'g\'ri kiriting');
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const submit = async () => {
    if (mode === 'login') {
      const input = LoginInputSchema.safeParse({ login: email, password });
      return input.success ? run(() => login(input.data)) : invalid();
    }
    if (!usernameAcceptable(usernameCheck)) {
      return setError('message' in usernameCheck ? usernameCheck.message : 'Username tekshirilmoqda, biroz kuting');
    }
    const normalized = normalizeUsername(username);
    const input = RegisterInputSchema.safeParse({ email, password, displayName, ...(normalized ? { username: normalized } : {}) });
    return input.success ? run(() => register(input.data)) : invalid();
  };

  const inputProps = { style: styles.input, placeholderTextColor: palette.textDisabled, editable: !busy };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="chatbubbles" size={40} color={palette.onPrimary} />
          </View>
          <Text style={styles.brand} accessibilityRole="header">Suhbat</Text>
          <Text style={styles.subtitle}>{mode === 'login' ? 'Hisobingizga kiring' : 'Yangi hisob yarating'}</Text>
          {mode === 'register' && (
            <TextInput {...inputProps} placeholder="Ism" value={displayName} onChangeText={setDisplayName}
              autoComplete="name" accessibilityLabel="Ism" />
          )}
          {mode === 'login' ? (
            <TextInput {...inputProps} placeholder="Email yoki username" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} autoComplete="username" accessibilityLabel="Email yoki username" />
          ) : (
            <>
              <TextInput {...inputProps} placeholder="Email" value={email} onChangeText={setEmail}
                autoCapitalize="none" autoComplete="email" keyboardType="email-address" accessibilityLabel="Email" />
              <UsernameInput value={username} onChange={setUsername} check={usernameCheck} optional editable={!busy}
                inputStyle={styles.input} />
            </>
          )}
          <TextInput {...inputProps} placeholder="Parol" value={password} onChangeText={setPassword}
            secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            accessibilityLabel="Parol" onSubmitEditing={submit} />
          {mode === 'login' && (
            <Pressable onPress={() => onForgot(email.trim())} disabled={busy}
              accessibilityRole="button" style={styles.forgot}>
              <Text style={styles.switch}>Parolni unutdim?</Text>
            </Pressable>
          )}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy}
            accessibilityRole="button">
            {busy
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.buttonText}>{mode === 'login' ? 'Kirish' : 'Ro\'yxatdan o\'tish'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            disabled={busy} accessibilityRole="button">
            <Text style={styles.switch}>
              {mode === 'login' ? 'Hisobingiz yo\'qmi? Ro\'yxatdan o\'ting' : 'Hisobingiz bormi? Kiring'}
            </Text>
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
  logo:       { alignSelf: 'center', width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.primary, marginBottom: space.xs },
  brand:      { ...textStyles.title, color: p.textPrimary, textAlign: 'center' },
  subtitle:   { ...textStyles.body, color: p.textSecondary, textAlign: 'center', marginBottom: space.sm },
  input:      { ...textStyles.body, fontSize: 16, borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.md, color: p.textPrimary, backgroundColor: p.surfaceHighlight },
  error:      { ...textStyles.bodySmall, color: p.danger },
  button:     { minHeight: 48, backgroundColor: p.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  buttonBusy: { opacity: 0.7 },
  buttonText: { ...textStyles.button, color: p.onPrimary },
  switch:     { ...textStyles.bodySmall, color: p.primary, textAlign: 'center', paddingVertical: space.xs },
  forgot:     { alignSelf: 'flex-end' },
});
