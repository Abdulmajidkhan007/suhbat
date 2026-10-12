import { canWrite, messageStatus, toMillis } from '@suhbat/core';
import type { ChatSummary } from '@suhbat/core';
import type { Palette } from '@suhbat/ui-tokens';
import { fontSize, spacing } from '@suhbat/ui-tokens';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Composer } from '../components/Composer';
import { MessageBubble } from '../components/MessageBubble';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigation } from '../navigation/Navigator';
import type { LocalMessage } from '../state/chatState';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser } from '../state/SessionProvider';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatTime } from '../utils/format';

const EMPTY: LocalMessage[] = [];

/** Sarlavha ostidagi holat: yozmoqda / onlayn / oxirgi marta / a'zolar soni. */
const subtitleFor = (chat: ChatSummary, myId: string, typingIds: string[], online: Record<string, boolean>): string => {
  if (typingIds.length > 0) {
    if (chat.type === 'direct') return 'yozmoqda...';
    const names = chat.members.filter((m) => typingIds.includes(m.user.id)).map((m) => m.user.displayName);
    return `${names.join(', ') || 'kimdir'} yozmoqda...`;
  }
  const peer = directPeerId(chat, myId);
  if (peer) {
    if (online[peer]) return 'onlayn';
    const seen = chat.members.find((m) => m.user.id === peer)?.lastSeenAt;
    return seen ? `oxirgi marta ${formatTime(seen)}` : 'oflayn';
  }
  return chat.type === 'channel' ? `${chat.memberCount} obunachi` : `${chat.memberCount} a'zo`;
};

export const ChatScreen = ({ chatId }: { chatId: string }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const me = useCurrentUser();
  const { back } = useNavigation();
  const { state, loadMessages, sendText, resend, setTyping, markRead, setActiveChat } = useChatStore();
  const chat = state.chats[chatId];
  const page = state.messages[chatId];
  const items = page?.items ?? EMPTY;
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    setActiveChat(chatId);
    loadMessages(chatId).catch(() => setError('Xabarlarni yuklab bo\'lmadi'));
    return () => setActiveChat(null);
  }, [chatId, loadMessages, setActiveChat]);

  // Ekrandagi eng oxirgi begona xabar o'qilmagan bo'lsa — o'qildi deb belgilash.
  const myLastReadAt = chat?.members.find((m) => m.user.id === me.id)?.lastReadAt ?? null;
  const lastIncoming = useMemo(() => [...items].reverse().find((m) => m.senderId !== me.id && !m.local), [items, me.id]);
  useEffect(() => {
    if (!lastIncoming) return;
    const readAt = toMillis(myLastReadAt) ?? 0;
    if ((toMillis(lastIncoming.createdAt) ?? 0) > readAt || (chat?.unreadCount ?? 0) > 0) {
      markRead(chatId, lastIncoming.id);
    }
  }, [chatId, lastIncoming, myLastReadAt, chat?.unreadCount, markRead]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !page?.nextCursor) return;
    setLoadingOlder(true);
    try {
      await loadMessages(chatId, true);
    } catch {
      setError('Eski xabarlarni yuklab bo\'lmadi');
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, loadMessages, loadingOlder, page?.nextCursor]);

  // Inverted FlatList: eng yangisi pastda.
  const data = useMemo(() => [...items].reverse(), [items]);

  if (!chat) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Chat" onBack={back} />
        <ActivityIndicator style={styles.center} color={palette.primary} />
      </View>
    );
  }

  const myRole = chat.members.find((m) => m.user.id === me.id)?.role ?? 'member';
  const writable = canWrite(chat.type, myRole);
  const showSender = chat.type === 'group';
  const nameOf = (id: string) => chat.members.find((m) => m.user.id === id)?.user.displayName;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={chatTitle(chat, me.id)}
        subtitle={subtitleFor(chat, me.id, state.typing[chatId] ?? [], state.online)}
        onBack={back}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        data={data}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            own={item.senderId === me.id}
            status={messageStatus(item, chat.members)}
            senderName={showSender ? nameOf(item.senderId) : undefined}
            onRetry={resend}
          />
        )}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingOlder ? <ActivityIndicator color={palette.primary} /> : undefined}
        ListEmptyComponent={
          page?.loaded ? <Text style={styles.empty}>Hali xabar yo'q</Text> : <ActivityIndicator color={palette.primary} />
        }
      />
      {writable ? (
        <Composer onSend={(text) => void sendText(chatId, text)} onTyping={(t) => setTyping(chatId, t)} />
      ) : (
        <Text style={styles.readonly}>Bu kanalda faqat adminlar yozadi</Text>
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:     { flex: 1, backgroundColor: p.background },
  list:     { flex: 1 },
  center:   { flex: 1 },
  error:    { padding: spacing(2), color: p.danger, textAlign: 'center' },
  // Inverted ro'yxatda bo'sh holat teskari aylanadi — qaytarib to'g'rilaymiz.
  empty:    { padding: spacing(8), textAlign: 'center', color: p.textSecondary, transform: [{ scaleY: -1 }] },
  readonly: { padding: spacing(4), textAlign: 'center', color: p.textSecondary, fontSize: fontSize.sm, backgroundColor: p.surface },
});
