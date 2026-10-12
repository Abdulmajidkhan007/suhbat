import type { ChatSummary } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, radius, spacing } from '@suhbat/ui-tokens';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { HeaderButton } from '../components/HeaderButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigation } from '../navigation/Navigator';
import { sortedChats } from '../state/chatState';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { useStyles } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatTime, messagePreview } from '../utils/format';

export const ChatListScreen = () => {
  const styles = useStyles(createStyles);
  const me = useCurrentUser();
  const { logout } = useSession();
  const { state, refreshChats } = useChatStore();
  const { push } = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const chats = useMemo(() => sortedChats(state), [state]);

  const renderItem = ({ item }: { item: ChatSummary }) => {
    const title = chatTitle(item, me.id);
    const peer = directPeerId(item, me.id);
    const typing = (state.typing[item.id]?.length ?? 0) > 0;
    return (
      <Pressable style={styles.item} onPress={() => push({ name: 'chat', chatId: item.id })} accessibilityRole="button">
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
            <HeaderButton label="Yangi" onPress={() => push({ name: 'newChat' })} />
            <HeaderButton label="Chiqish" danger onPress={() => void logout()} />
          </View>
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  empty:     { padding: spacing(8), textAlign: 'center', color: p.textSecondary, fontSize: fontSize.md },
  error:     { padding: spacing(3), color: p.danger, textAlign: 'center' },
});
