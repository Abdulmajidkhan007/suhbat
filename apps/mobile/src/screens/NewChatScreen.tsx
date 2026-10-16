import type { PublicUser } from '@suhbat/core';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { useUserSearch } from '../hooks/useUserSearch';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { useChatStore } from '../state/ChatStoreProvider';
import { space } from '../theme/metrics';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';

export const NewChatScreen = () => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const { openDirect, state } = useChatStore();
  const { back, replace } = useNavigation();
  const [query, setQuery] = useState('');
  const [openError, setOpenError] = useState(false);
  const search = useUserSearch(query);

  const open = async (user: PublicUser) => {
    try {
      setOpenError(false);
      const chat = await openDirect(user.id);
      replace({ name: 'chat', chatId: chat.id });
    } catch {
      setOpenError(true);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('new.chatTitle')} onBack={back} />
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('add.placeholder')}
        label={t('new.searchLabel')}
        autoFocus
      />
      {!query.trim() ? (
        <View>
          <ListRow title={t('list.newGroup')} icon="people-outline" iconColor={palette.primary} onPress={() => replace({ name: 'newGroup', kind: 'group' })} />
          <ListRow title={t('list.newChannel')} icon="megaphone-outline" iconColor={palette.secondary} onPress={() => replace({ name: 'newGroup', kind: 'channel' })} />
        </View>
      ) : null}
      {search.loading ? <ActivityIndicator style={styles.loader} color={palette.primary} accessibilityLabel={t('search.searching')} /> : null}
      {openError ? <EmptyState error title={t('new.openError')} /> : null}
      <FlatList
        data={search.results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListRow
            title={item.displayName}
            subtitle={item.bio ?? undefined}
            left={<Avatar name={item.displayName} seed={item.id} size={42} online={state.online[item.id] === true} />}
            onPress={() => void open(item)}
          />
        )}
        ListEmptyComponent={
          search.error ? (
            <EmptyState error title={t('new.searchError')} onRetry={search.retry} />
          ) : query.trim() && !search.loading ? (
            <EmptyState icon="search" title={t('new.nobody')} body={t('add.hint')} />
          ) : undefined
        }
      />
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: p.surface },
  loader: { marginVertical: space.md },
});
