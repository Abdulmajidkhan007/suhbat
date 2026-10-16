import type { PublicUser } from '@suhbat/core';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { UserPicker } from '../components/UserPicker';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useChatStore } from '../state/ChatStoreProvider';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

export const AddMembersScreen = ({ chatId }: { chatId: string }) => {
  const styles = useStyles(createStyles);
  const { back } = useNavigation();
  const { state, addMembers } = useChatStore();
  const chat = state.chats[chatId];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlyMap<string, PublicUser>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const existing = useMemo(() => new Set(chat?.members.map((m) => m.user.id) ?? []), [chat?.members]);

  const toggle = (user: PublicUser) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(user.id)) next.delete(user.id);
    else next.set(user.id, user);
    return next;
  });

  const submit = async () => {
    setSaving(true);
    setError(false);
    try {
      await addMembers(chatId, [...selected.keys()]);
      back();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const count = selected.size;
  return (
    <View style={styles.root}>
      <ScreenHeader title={chat?.type === 'channel' ? t('info.addSubscribers') : t('add.title')} onBack={back} />
      <SearchField value={query} onChangeText={setQuery} placeholder={t('add.placeholder')} label={t('new.searchLabel')} autoFocus />
      <View style={styles.list}>
        <UserPicker query={query} selected={selected} onToggle={toggle} excluded={existing} />
      </View>
      <View style={styles.footer}>
        {error ? <Text style={styles.error} accessibilityRole="alert">{t('add.error')}</Text> : null}
        <PrimaryButton label={t('add.submit', { n: count })} onPress={() => void submit()} disabled={count === 0} loading={saving} />
      </View>
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: p.surface },
  list:   { flex: 1 },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
  error:  { ...textStyles.bodySmall, color: p.danger, textAlign: 'center' },
});
