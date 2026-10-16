import { BIO_MAX, DISPLAY_NAME_MAX, UpdateProfileInputSchema } from '@suhbat/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';

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
  const nameError = name.trim().length === 0 ? t('profile.nameRequired') : null;
  const canSave = parsed.success && dirty && !saving;

  const save = async () => {
    if (!parsed.success) return;
    setSaving(true);
    setMessage(null);
    try {
      updateUser(await api.updateProfile(parsed.data));
      haptics.success();
      setMessage({ text: t('profile.saved'), ok: true });
    } catch {
      setMessage({ text: t('profile.saveError'), ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('profile.title')} onBack={back} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Avatar name={name.trim() || me.displayName} seed={me.id} size={96} />
          <Text style={styles.email}>{me.email}</Text>
          <Text style={styles.hint}>{t('profile.avatarLater')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('profile.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            maxLength={DISPLAY_NAME_MAX}
            placeholderTextColor={palette.textDisabled}
            accessibilityLabel={t('profile.name')}
          />
          {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

          <Text style={styles.label}>{t('profile.bio')}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX}
            multiline
            placeholderTextColor={palette.textDisabled}
            accessibilityLabel={t('profile.bio')}
          />
          <Text style={styles.counter}>{bio.length}/{BIO_MAX}</Text>
        </View>

        {message ? <Text style={message.ok ? styles.ok : styles.error} accessibilityRole="alert">{message.text}</Text> : null}
        <PrimaryButton label={t('common.save')} onPress={() => void save()} disabled={!canSave} loading={saving} />
      </ScrollView>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { flex: 1, backgroundColor: p.background },
  body:      { padding: space.lg, gap: space.md },
  hero:      { alignItems: 'center', gap: space.xs, marginVertical: space.md },
  email:     { ...textStyles.body, color: p.textSecondary, marginTop: space.sm },
  hint:      { ...textStyles.caption, color: p.textDisabled },
  card:      { backgroundColor: p.surface, borderRadius: radii.md, padding: space.lg, gap: space.sm },
  label:     { ...textStyles.bodySmall, color: p.primary, fontWeight: '600' },
  input: {
    ...textStyles.body, fontSize: 16, color: p.textPrimary, backgroundColor: p.surfaceHighlight,
    borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.sm + 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  counter:   { ...textStyles.caption, alignSelf: 'flex-end', color: p.textSecondary },
  error:     { ...textStyles.bodySmall, color: p.danger },
  ok:        { ...textStyles.bodySmall, color: p.success },
});
