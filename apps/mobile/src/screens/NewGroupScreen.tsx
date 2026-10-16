import { CreateChannelInputSchema, CreateGroupInputSchema } from '@suhbat/core';
import type { PublicUser } from '@suhbat/core';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { UserPicker } from '../components/UserPicker';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useChatStore } from '../state/ChatStoreProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

/** Guruh (nom + a'zolar) yoki kanal (nom, tavsif, ochiq/yopiq) yaratish. */
export const NewGroupScreen = ({ kind }: { kind: 'group' | 'channel' }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { back, replace } = useNavigation();
  const { createGroup, createChannel } = useChatStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlyMap<string, PublicUser>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const channel = kind === 'channel';

  const desc = description.trim() || undefined;
  const channelInput = CreateChannelInputSchema.safeParse({ title, description: desc, isPublic });
  const groupInput = CreateGroupInputSchema.safeParse({ title, description: desc, memberIds: [...selected.keys()] });
  const valid = channel ? channelInput.success : groupInput.success;

  const toggle = (user: PublicUser) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(user.id)) next.delete(user.id);
    else next.set(user.id, user);
    return next;
  });

  const submit = async () => {
    const run = channel
      ? channelInput.success ? () => createChannel(channelInput.data) : null
      : groupInput.success ? () => createGroup(groupInput.data) : null;
    if (!run) return;
    setSaving(true);
    setError(false);
    try {
      const chat = await run();
      replace({ name: 'chat', chatId: chat.id });
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  const form = (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={channel ? t('new.channelName') : t('new.groupName')}
        placeholderTextColor={palette.textSecondary}
        maxLength={128}
        autoFocus
        accessibilityLabel={channel ? t('new.channelName') : t('new.groupName')}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('new.description')}
        placeholderTextColor={palette.textSecondary}
        maxLength={512}
        multiline
        accessibilityLabel={t('new.description')}
      />
      {channel ? (
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchTitle}>{t('new.public')}</Text>
            <Text style={styles.hint}>{t('new.publicHint')}</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ true: palette.primary, false: palette.divider }}
            accessibilityLabel={t('new.public')}
          />
        </View>
      ) : (
        <>
          <Text style={styles.hint}>{t('new.membersHint')}</Text>
          <SearchField value={query} onChangeText={setQuery} placeholder={t('add.placeholder')} label={t('new.searchLabel')} />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={channel ? t('new.channelTitle') : t('new.groupTitle')} onBack={back} />
      <View style={styles.flex}>
        {channel ? form : <UserPicker query={query} selected={selected} onToggle={toggle} header={form} />}
      </View>
      <View style={styles.footer}>
        {error ? <Text style={styles.error} accessibilityRole="alert">{t('new.createError')}</Text> : null}
        <PrimaryButton label={t('new.create')} onPress={() => void submit()} disabled={!valid} loading={saving} />
      </View>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:        { flex: 1, backgroundColor: p.surface },
  flex:        { flex: 1 },
  form:        { paddingTop: space.md, gap: space.md },
  input: {
    ...textStyles.body, fontSize: 16, color: p.textPrimary, backgroundColor: p.surfaceHighlight,
    borderRadius: radii.md, paddingHorizontal: space.md, paddingVertical: space.sm + 4, marginHorizontal: space.lg,
  },
  multiline:   { minHeight: 72, textAlignVertical: 'top' },
  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  switchTitle: { ...textStyles.body, fontSize: 16, color: p.textPrimary },
  hint:        { ...textStyles.bodySmall, color: p.textSecondary, paddingHorizontal: space.lg },
  footer:      { padding: space.lg, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
  error:       { ...textStyles.bodySmall, color: p.danger, textAlign: 'center' },
});
