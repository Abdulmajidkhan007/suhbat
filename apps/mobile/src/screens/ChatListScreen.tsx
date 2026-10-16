import { messageStatus } from '@suhbat/core';
import type { ChatSummary, PublicChannel, PublicUser } from '@suhbat/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionSheet } from '../components/ActionSheet';
import { Avatar } from '../components/Avatar';
import { ChatListItem } from '../components/ChatListItem';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchField } from '../components/SearchField';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import { sortedChats } from '../state/chatState';
import type { ChatState } from '../state/chatState';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser } from '../state/SessionProvider';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatCount } from '../utils/format';

const SectionHeader = ({ title }: { title: string }) => {
  const styles = useStyles(createStyles);
  return <Text style={styles.section} accessibilityRole="header">{title}</Text>;
};

const SectionError = ({ text, onRetry }: { text: string; onRetry: () => void }) => {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.sectionError} accessibilityRole="alert">
      <Text style={styles.error}>{text}</Text>
      <Text style={styles.retry} onPress={onRetry} accessibilityRole="button">{t('common.retry')}</Text>
    </View>
  );
};

/** Ro'yxatda "yozmoqda" matni: 1:1 — "yozmoqda...", guruhda — "Ali yozmoqda...". */
const typingText = (chat: ChatSummary, state: ChatState): string | null => {
  const ids = state.typing[chat.id] ?? [];
  if (ids.length === 0) return null;
  if (chat.type === 'direct') return t('list.typing');
  const name = chat.members.find((m) => m.user.id === ids[0])?.user.displayName.split(' ')[0];
  return name ? t('list.typingName', { name }) : t('list.typing');
};

export const ChatListScreen = () => {
  const styles = useStyles(createStyles);
  const me = useCurrentUser();
  const { palette } = useTheme();
  const { state, refreshChats, openDirect, joinChannel } = useChatStore();
  const { push } = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const search = useGlobalSearch(query);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshChats();
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, [refreshChats]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const allChats = useMemo(() => sortedChats(state), [state]);
  const chats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allChats.filter((c) => chatTitle(c, me.id).toLowerCase().includes(q)) : allChats;
  }, [allChats, query, me.id]);

  const openChat = useCallback((chatId: string) => {
    setQuery('');
    push({ name: 'chat', chatId });
  }, [push]);

  const openUser = async (user: PublicUser) => {
    try {
      openChat((await openDirect(user.id)).id);
    } catch {
      Alert.alert(t('common.error'), t('search.openError'));
    }
  };

  const openChannel = (channel: PublicChannel) => {
    const join = async () => {
      try {
        if (!channel.isMember) await joinChannel(channel.id);
        openChat(channel.id);
      } catch {
        Alert.alert(t('common.error'), t('search.joinError'));
      }
    };
    Alert.alert(
      channel.title,
      `${t('chat.subscribers', { n: channel.memberCount })}${channel.description ? `\n\n${channel.description}` : ''}`,
      [
        { text: t('common.close'), style: 'cancel' },
        { text: channel.isMember ? t('search.open') : t('search.subscribe'), onPress: () => void join() },
      ],
    );
  };

  const renderChat = useCallback(({ item }: { item: ChatSummary }) => {
    const peer = directPeerId(item, me.id);
    const last = item.lastMessage;
    return (
      <ChatListItem
        chat={item}
        title={chatTitle(item, me.id)}
        myId={me.id}
        online={peer ? state.online[peer] === true : false}
        typing={typingText(item, state)}
        status={last && last.senderId === me.id ? messageStatus(last, item.members) : null}
        onPress={openChat}
      />
    );
  }, [me.id, state, openChat]);

  const noResults = !search.loading && chats.length === 0 && search.users.length === 0
    && search.channels.length === 0 && !search.usersError && !search.channelsError;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('list.title')}
        large
        right={<IconButton icon="create-outline" label={t('list.new')} onPress={() => setMenuOpen(true)} />}
      />
      <ConnectionBanner />
      <SearchField value={query} onChangeText={setQuery} />
      {search.active ? (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {chats.length > 0 ? (
            <>
              <SectionHeader title={t('search.chats')} />
              {chats.map((c) => <View key={c.id}>{renderChat({ item: c })}</View>)}
            </>
          ) : null}
          {search.loading ? (
            <ActivityIndicator style={styles.loader} color={palette.primary} accessibilityLabel={t('search.searching')} />
          ) : null}
          {!search.loading && (search.users.length > 0 || search.usersError) ? (
            <>
              <SectionHeader title={t('search.users')} />
              {search.usersError ? <SectionError text={t('search.usersError')} onRetry={search.retry} /> : null}
              {search.users.map((u) => (
                <ListRow
                  key={u.id}
                  title={u.displayName}
                  subtitle={u.bio ?? undefined}
                  left={<Avatar name={u.displayName} seed={u.id} size={42} online={state.online[u.id] === true} />}
                  onPress={() => void openUser(u)}
                />
              ))}
            </>
          ) : null}
          {!search.loading && (search.channels.length > 0 || search.channelsError) ? (
            <>
              <SectionHeader title={t('search.channels')} />
              {search.channelsError ? <SectionError text={t('search.channelsError')} onRetry={search.retry} /> : null}
              {search.channels.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.title}
                  subtitle={`${t('chat.subscribers', { n: formatCount(c.memberCount) })}${c.description ? ` · ${c.description}` : ''}`}
                  left={<Avatar name={c.title} seed={c.id} size={42} icon="megaphone-outline" />}
                  onPress={() => openChannel(c)}
                />
              ))}
            </>
          ) : null}
          {noResults ? <EmptyState icon="search" title={t('common.notFound')} /> : null}
        </ScrollView>
      ) : !loaded ? (
        <LoadingState />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={renderChat}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} colors={[palette.primary]} tintColor={palette.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={chats.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            error ? (
              <EmptyState error title={t('list.loadError')} onRetry={() => void reload()} />
            ) : (
              <EmptyState
                title={t('list.empty.title')}
                body={t('list.empty.body')}
                onRetry={() => push({ name: 'newChat' })}
                actionLabel={t('list.newChat')}
              />
            )
          }
        />
      )}
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { key: 'chat',    label: t('list.newChat'),    icon: 'person-outline',    onPress: () => push({ name: 'newChat' }) },
          { key: 'group',   label: t('list.newGroup'),   icon: 'people-outline',    onPress: () => push({ name: 'newGroup', kind: 'group' }) },
          { key: 'channel', label: t('list.newChannel'), icon: 'megaphone-outline', onPress: () => push({ name: 'newGroup', kind: 'channel' }) },
        ]}
      />
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:           { flex: 1, backgroundColor: p.surface },
  separator:      { height: StyleSheet.hairlineWidth, marginLeft: 76, backgroundColor: p.divider },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  section: {
    ...textStyles.section, color: p.textSecondary, backgroundColor: p.background,
    paddingHorizontal: space.lg, paddingVertical: space.xs + 2,
  },
  sectionError:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  loader:         { marginVertical: space.lg },
  error:          { ...textStyles.bodySmall, color: p.danger, flex: 1 },
  retry:          { ...textStyles.button, color: p.primary, paddingLeft: space.md, paddingVertical: space.sm },
});
