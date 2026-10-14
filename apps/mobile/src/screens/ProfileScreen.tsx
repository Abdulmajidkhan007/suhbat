import { BIO_MAX, DISPLAY_NAME_MAX, UpdateProfileInputSchema } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigation } from '../navigation/Navigator';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { useStyles, useTheme } from '../theme/ThemeProvider';

/** Profilni tahrirlash: ism va "men haqimda". Avatar yuklash — keyinroq (S3 sozlanmagan). */
export const ProfileScreen = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const me = useCurrentUser();
  const { services: { api }, updateUser } = useSession();
  const { back } = useNavigation();
  const [name, setName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const parsed = UpdateProfileInputSchema.safeParse({ displayName: name, bio });
  const dirty = name.trim() !== me.displayName || bio.trim() !== (me.bio ?? '');
  const nameError = name.trim().length === 0 ? 'Ism bo\'sh bo\'lmasin' : null;
  const canSave = parsed.success && dirty && !saving;

  const save = async () => {
    if (!parsed.success) return;
    setSaving(true);
    setMessage(null);
    try {
      updateUser(await api.updateProfile(parsed.data));
      setMessage({ text: 'Profil saqlandi', ok: true });
    } catch {
      setMessage({ text: 'Profilni saqlab bo\'lmadi. Qayta urinib ko\'ring.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profil" onBack={back} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}><Avatar name={me.displayName} size={72} /></View>
        <Text style={styles.email}>{me.email}</Text>

        <Text style={styles.label}>Ism</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={DISPLAY_NAME_MAX}
          placeholderTextColor={palette.textDisabled}
          accessibilityLabel="Ism"
        />
        {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

        <Text style={styles.label}>Men haqimda</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={setBio}
          maxLength={BIO_MAX}
          multiline
          placeholderTextColor={palette.textDisabled}
          accessibilityLabel="Men haqimda"
        />
        <Text style={styles.counter}>{bio.length}/{BIO_MAX}</Text>

        {message ? <Text style={message.ok ? styles.ok : styles.error} accessibilityRole="alert">{message.text}</Text> : null}

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={() => void save()}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Saqlash</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { flex: 1, backgroundColor: p.surface },
  body:      { padding: spacing(4), gap: spacing(2) },
  avatar:    { alignItems: 'center', marginTop: spacing(2) },
  email:     { textAlign: 'center', color: p.textSecondary, fontSize: fontSize.sm, marginBottom: spacing(3) },
  label:     { color: p.textSecondary, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing(2) },
  input:     { paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), borderRadius: radius.md, backgroundColor: p.background, color: p.textPrimary, fontSize: fontSize.md },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  counter:   { alignSelf: 'flex-end', color: p.textSecondary, fontSize: fontSize.xs },
  error:     { color: p.danger, fontSize: fontSize.sm },
  ok:        { color: p.primary, fontSize: fontSize.sm },
  button:    { marginTop: spacing(3), alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: radius.md, backgroundColor: p.primary },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },
});
