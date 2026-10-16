import { ApiError } from '@suhbat/client';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSession } from '../state/SessionProvider';
import { useStyles, useTheme } from '../theme/ThemeProvider';

const failureText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'Email yuborish hozircha sozlanmagan. Keyinroq urinib ko\'ring.';
    if (e.status === 429) return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
    if (e.status === 0) return e.message;
  }
  return 'So\'rovni yuborib bo\'lmadi. Qayta urinib ko\'ring.';
};

/**
 * "Parolni unutdim": email yoki username → xatda havola. Havola **vebda** ochiladi
 * (yangi parol o'sha yerda o'rnatiladi), keyin ilovada yangi parol bilan kiriladi.
 */
export const ForgotPasswordScreen = ({ onBack, initialValue = '' }: { onBack: () => void; initialValue?: string }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { services: { api } } = useSession();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const submit = async () => {
    if (!value.trim()) return setError('Email yoki username kiriting');
    setBusy(true);
    setError(null);
    try {
      setSent((await api.forgotPassword(value.trim())).message);
    } catch (e) {
      setError(failureText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">Parolni tiklash</Text>
          {sent ? (
            <>
              <Text style={styles.ok} accessibilityRole="alert">{sent}</Text>
              <Text style={styles.hint}>
                Xatdagi havolani oching — yangi parol veb sahifada o'rnatiladi. Keyin shu yerda yangi parol bilan kiring.
                Havola 30 daqiqa amal qiladi.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.hint}>Hisobingiz emaili yoki username'ini kiriting — parolni tiklash havolasini emailga yuboramiz.</Text>
              <TextInput style={styles.input} value={value} onChangeText={setValue} placeholder="Email yoki username"
                placeholderTextColor={palette.textDisabled} autoCapitalize="none" autoCorrect={false} autoComplete="username"
                editable={!busy} accessibilityLabel="Email yoki username" onSubmitEditing={submit} />
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Havola yuborish</Text>}
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
  content:    { flexGrow: 1, justifyContent: 'center', padding: spacing(4) },
  card:       { width: '100%', maxWidth: 420, alignSelf: 'center', gap: spacing(3), padding: spacing(6), borderRadius: radius.lg, backgroundColor: p.surface },
  title:      { fontSize: fontSize.xl, fontWeight: '800', color: p.textPrimary, textAlign: 'center' },
  hint:       { fontSize: fontSize.sm, color: p.textSecondary, textAlign: 'center' },
  input:      { borderWidth: 1, borderColor: p.divider, borderRadius: radius.md, paddingHorizontal: spacing(3), paddingVertical: spacing(3), fontSize: fontSize.md, color: p.textPrimary, backgroundColor: p.background },
  error:      { color: p.danger, fontSize: fontSize.sm },
  ok:         { color: p.primary, fontSize: fontSize.md, textAlign: 'center' },
  button:     { backgroundColor: p.primary, borderRadius: radius.md, paddingVertical: spacing(3), alignItems: 'center' },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },
  link:       { color: p.primary, fontSize: fontSize.sm, textAlign: 'center' },
});
