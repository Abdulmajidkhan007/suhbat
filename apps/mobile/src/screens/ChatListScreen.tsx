import type { ChatSummary, PublicChannel, PublicUser } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { HeaderButton } from '../components/HeaderButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigation } from '../navigation/Navigator';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { sortedChats } from '../state/chatState';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatTime, messagePreview } from '../utils/format';

const SectionError = ({ text, onRetry }: { text: string; onRetry: () => void }) => {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.sectionError} accessibilityRole="alert">
      <Text style={styles.error}>{text}</Text>
      <HeaderButton label="Qayta urinish" onPress={onRetry} />
    </View>
  );
};

export const ChatListScreen = () => {
  const styles = useStyles(createStyles);
  const me = useCurrentUser();
  const { logout } = useSession();
  const { palette } = useTheme();
  const { state, refreshChats, openDirect, joinChannel } = useChatStore();
  const { push } = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const search = useGlobalSearch(query);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshChats();
      setError(null);
    } catch {
      setError('Chatlarni yuklab bo\'lmadi. Tortib yangilang.');
    } finally {
      setRefreshing(false);
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

  const openChat = (chatId: string) => {
    setQuery('');
    push({ name: 'chat', chatId });
  };

  const openUser = async (user: PublicUser) => {
    try {
      openChat((await openDirect(user.id)).id);
    } catch {
      Alert.alert('Xato', 'Suhbatni boshlab bo\'lmadi. Qayta urinib ko\'ring.');
    }
  };

  const openChannel = (channel: PublicChannel) => {
    const join = async () => {
      try {
        if (!channel.isMember) await joinChannel(channel.id);
        openChat(channel.id);
      } catch {
        Alert.alert('Xato', 'Kanalga obuna bo\'lib bo\'lmadi.');
      }
    };
    Alert.alert(
      channel.title,
      `${channel.memberCount} obunachi${channel.description ? `\n\n${channel.description}` : ''}`,
      [
        { text: 'Yopish', style: 'cancel' },
        { text: channel.isMember ? 'Ochish' : 'Obuna bo\'lish', onPress: () => void join() },
      ],
    );
  };

  const renderItem = ({ item }: { item: ChatSummary }) => {
    const title = chatTitle(item, me.id);
    const peer = directPeerId(item, me.id);
    const typing = (state.typing[item.id]?.length ?? 0) > 0;
    return (
      <Pressable style={styles.item} onPress={() => openChat(item.id)} accessibilityRole="button">
        <Avatar name={title} online={peer ? state.online[peer] === true : false} />
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {item.lastMessage ? <Text style={styles.time}>{formatTime(item.lastMessage.createdAt)}</Text> : null}
          </View>
          <View style={styles.itemRow}>
            <Text style={[styles.preview, typing && styles.typing]} numberOfLines={1}>
              {typing ? 'yozmoqda...' : item.lastMessage ? messagePreview(item.lastMessage) : 'Xabarlar yo\'q'}
            </Text>
            {item.unreadCount > 0 ? (
              <View style={styles.badge} accessibilityLabel={`${item.unreadCount} ta o'qilmagan`}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Suhbat"
        subtitle={me.displayName}
        right={
          <View style={styles.actions}>
            <HeaderButton label="Profil" onPress={() => push({ name: 'profile' })} />
            <HeaderButton label="Yangi" onPress={() => push({ name: 'newChat' })} />
            <HeaderButton label="Chiqish" danger onPress={() => void logout()} />
          </View>
        }
      />
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Qidirish"
        placeholderTextColor={palette.textDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Qidirish"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {search.active ? (
        <ScrollView keyboardShouldPersistTaps="handled">
          {chats.length > 0 ? (
            <>
              <Text style={styles.section} accessibilityRole="header">Suhbatlar</Text>
              {chats.map((c) => <View key={c.id}>{renderItem({ item: c })}</View>)}
            </>
          ) : null}
          {search.loading ? <ActivityIndicator style={styles.loader} color={palette.primary} accessibilityLabel="Qidirilmoqda" /> : null}
          {!search.loading && (search.users.length > 0 || search.usersError) ? (
            <>
              <Text style={styles.section} accessibilityRole="header">Foydalanuvchilar</Text>
              {search.usersError ? <SectionError text="Foydalanuvchilarni qidirib bo'lmadi." onRetry={search.retry} /> : null}
              {search.users.map((u) => (
                <Pressable key={u.id} style={styles.item} onPress={() => void openUser(u)} accessibilityRole="button">
                  <Avatar name={u.displayName} size={40} />
                  <View style={styles.itemBody}>
                    <Text style={styles.title} numberOfLines={1}>{u.displayName}</Text>
                    {u.username || u.bio ? (
                      <Text style={styles.preview} numberOfLines={1}>
                        {[u.username ? `@${u.username}` : null, u.bio].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
          {!search.loading && (search.channels.length > 0 || search.channelsError) ? (
            <>
              <Text style={styles.section} accessibilityRole="header">Ochiq kanallar</Text>
              {search.channelsError ? <SectionError text="Kanallarni qidirib bo'lmadi." onRetry={search.retry} /> : null}
              {search.channels.map((c) => (
                <Pressable key={c.id} style={styles.item} onPress={() => openChannel(c)} accessibilityRole="button">
                  <Avatar name={c.title} size={40} />
                  <View style={styles.itemBody}>
                    <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {`${c.memberCount} obunachi${c.description ? ` · ${c.description}` : ''}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
          {!search.loading && chats.length === 0 && search.users.length === 0 && search.channels.length === 0
            && !search.usersError && !search.channelsError ? (
            <Text style={styles.empty}>Topilmadi</Text>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            refreshing ? undefined : <Text style={styles.empty}>Hali chat yo'q. "Yangi" orqali suhbat boshlang.</Text>
          }
        />
      )}
    </View>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:      { flex: 1, backgroundColor: p.surface },
  actions:   { flexDirection: 'row', gap: spacing(4) },
  item:      { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingHorizontal: spacing(4), paddingVertical: spacing(3) },
  itemBody:  { flex: 1, gap: spacing(1) },
  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  title:     { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: p.textPrimary },
  time:      { fontSize: fontSize.xs, color: p.textSecondary },
  preview:   { flex: 1, fontSize: fontSize.sm, color: p.textSecondary },
  typing:    { color: p.primary, fontStyle: 'italic' },
  badge:     { minWidth: 22, height: 22, paddingHorizontal: spacing(1.5), borderRadius: radius.full, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: fontSize.xs, fontWeight: '700' },
  separator: { height: 1, marginLeft: spacing(18), backgroundColor: p.divider },
  search:    { margin: spacing(3), paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), borderRadius: radius.md, backgroundColor: p.background, color: p.textPrimary, fontSize: fontSize.md },
  section:   { paddingHorizontal: spacing(4), paddingTop: spacing(3), paddingBottom: spacing(1), color: p.textSecondary, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase' },
  sectionError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing(4) },
  loader:    { marginVertical: spacing(4) },
  empty:     { padding: spacing(8), textAlign: 'center', color: p.textSecondary, fontSize: fontSize.md },
  error:     { padding: spacing(3), color: p.danger, textAlign: 'center' },
});
