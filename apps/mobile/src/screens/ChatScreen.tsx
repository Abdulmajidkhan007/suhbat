import Clipboard from '@react-native-clipboard/clipboard';
import { canModerateMessages, canWrite, messageStatus, toMillis } from '@suhbat/core';
import type { CallMedia, ChatSummary } from '@suhbat/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useCall } from '../calls/useCall';
import { ActionSheet } from '../components/ActionSheet';
import type { SheetAction } from '../components/ActionSheet';
import { Avatar } from '../components/Avatar';
import { Composer } from '../components/Composer';
import type { EditTarget } from '../components/Composer';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { DateSeparator } from '../components/DateSeparator';
import { EmptyState, LoadingState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { MessageBubble } from '../components/MessageBubble';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useNavigation } from '../navigation/Navigator';
import type { LocalMessage } from '../state/chatState';
import { useChatStore } from '../state/ChatStoreProvider';
import { useCurrentUser, useSession } from '../state/SessionProvider';
import { radii, space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { chatTitle, directPeerId, formatCount, formatDayLabel, formatLastSeen, sameDay } from '../utils/format';
import { haptics } from '../utils/haptics';
import { subscriberCount } from '../utils/members';

const EMPTY: LocalMessage[] = [];
const NOTICE_MS = 3_000;

/** Sarlavha ostidagi holat: yozmoqda / onlayn / oxirgi marta / a'zolar soni. */
export const subtitleFor = (
  chat: ChatSummary, myId: string, typingIds: readonly string[], online: Record<string, boolean>,
): { text: string; accent: boolean } => {
  if (typingIds.length > 0) {
    if (chat.type === 'direct') return { text: t('list.typing'), accent: true };
    const names = chat.members.filter((m) => typingIds.includes(m.user.id)).map((m) => m.user.displayName.split(' ')[0]);
    return { text: t('list.typingName', { name: names.join(', ') || 'kimdir' }), accent: true };
  }
  const peer = directPeerId(chat, myId);
  if (peer) {
    if (online[peer]) return { text: t('chat.online'), accent: true };
    const seen = chat.members.find((m) => m.user.id === peer)?.lastSeenAt;
    return { text: seen ? t('chat.lastSeen', { when: formatLastSeen(seen) }) : t('chat.offline'), accent: false };
  }
  return chat.type === 'channel'
    ? { text: t('chat.subscribers', { n: formatCount(subscriberCount(chat.memberCount, chat.members)) }), accent: false }
    : { text: t('chat.members', { n: chat.memberCount }), accent: false };
};

export const ChatScreen = ({ chatId }: { chatId: string }) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const me = useCurrentUser();
  const { back, push } = useNavigation();
  const {
    state, loadMessages, sendText, resend, setTyping, markRead, setActiveChat, editMessage, deleteMessage, discardLocal,
    ensureChat,
  } = useChatStore();
  const chat = state.chats[chatId];
  const page = state.messages[chatId];
  const items = page?.items ?? EMPTY;
  const [loadError, setLoadError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [menuFor, setMenuFor] = useState<LocalMessage | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { services: { calls } } = useSession();
  const call = useCall();
  const inCall = call !== null && call.phase !== 'ended';

  const showNotice = useCallback((text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const load = useCallback(() => {
    setLoadError(false);
    loadMessages(chatId).catch(() => setLoadError(true));
  }, [chatId, loadMessages]);

  useEffect(() => {
    setActiveChat(chatId);
    load();
    return () => setActiveChat(null);
  }, [chatId, load, setActiveChat]);

  // Chat ro'yxatda hali yo'q (masalan, bildirishnomadan ochildi) — serverdan olinadi.
  const known = chat !== undefined;
  useEffect(() => {
    if (known) return;
    let cancelled = false;
    ensureChat(chatId).catch(() => {
      if (!cancelled) setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, known, ensureChat]);

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
      showNotice(t('chat.olderError'));
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, loadMessages, loadingOlder, page?.nextCursor, showNotice]);

  // Inverted FlatList: eng yangisi pastda.
  const data = useMemo(() => [...items].reverse(), [items]);

  const onLongPress = useCallback((m: LocalMessage) => {
    haptics.light();
    setMenuFor(m);
  }, []);

  if (!chat) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('common.loading')} onBack={back} />
        {missing
          ? <EmptyState error title={t('chat.blockedOrGone')} onRetry={back} actionLabel={t('common.back')} />
          : <LoadingState />}
      </View>
    );
  }

  const myRole = chat.members.find((m) => m.user.id === me.id)?.role ?? 'member';
  const writable = canWrite(chat.type, myRole);
  const moderator = canModerateMessages(chat.type, myRole);
  const showSender = chat.type === 'group';
  const nameOf = (id: string) => chat.members.find((m) => m.user.id === id)?.user.displayName;
  const peerId = directPeerId(chat, me.id);
  const peer = chat.members.find((m) => m.user.id === peerId)?.user;
  const title = chatTitle(chat, me.id);
  const subtitle = subtitleFor(chat, me.id, state.typing[chatId] ?? [], state.online);

  const startCall = (media: CallMedia) => {
    if (!peer) return;
    calls.startCall({ chatId, peer, media }).catch((e: unknown) => showNotice(e instanceof Error ? e.message : t('chat.callError')));
  };

  const submitEdit = (target: EditTarget, text: string) => {
    editMessage(chatId, target.id, text).then(
      () => setEditing(null),
      () => showNotice(t('menu.editError')),
    );
  };

  const confirmDelete = (m: LocalMessage) => {
    Alert.alert(t('menu.deleteTitle'), t('menu.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menu.delete'),
        style: 'destructive',
        onPress: () => {
          if (editing?.id === m.id) setEditing(null);
          deleteMessage(chatId, m.id).catch(() => showNotice(t('menu.deleteError')));
        },
      },
    ]);
  };

  const menuActions = (m: LocalMessage): SheetAction[] => {
    const own = m.senderId === me.id;
    const actions: SheetAction[] = [];
    if (m.local === 'failed') {
      actions.push({ key: 'retry', label: t('menu.retry'), icon: 'send', onPress: () => void resend(m) });
    }
    if (m.content) {
      actions.push({
        key: 'copy', label: t('menu.copy'), icon: 'copy-outline',
        onPress: () => {
          Clipboard.setString(m.content);
          showNotice(t('menu.copied'));
        },
      });
    }
    if (!m.local && own && m.type === 'text' && m.content && writable) {
      actions.push({ key: 'edit', label: t('menu.edit'), icon: 'pencil', onPress: () => setEditing({ id: m.id, content: m.content }) });
    }
    if (m.local === 'failed' && m.clientId) {
      const clientId = m.clientId;
      actions.push({ key: 'discard', label: t('menu.delete'), icon: 'trash-outline', destructive: true, onPress: () => discardLocal(chatId, clientId) });
    } else if (!m.local && (own || moderator)) {
      actions.push({ key: 'delete', label: t('menu.delete'), icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(m) });
    }
    return actions;
  };

  const renderItem = ({ item, index }: { item: LocalMessage; index: number }) => {
    const older = data[index + 1];
    const newer = data[index - 1];
    const newDay = !older || !sameDay(older.createdAt, item.createdAt);
    const tail = !newer || newer.senderId !== item.senderId || newer.type === 'system' || !sameDay(newer.createdAt, item.createdAt);
    const own = item.senderId === me.id;
    const grouped = !newDay && older?.senderId === item.senderId && older.type !== 'system';
    return (
      <View>
        {newDay ? <DateSeparator label={formatDayLabel(item.createdAt)} /> : null}
        <MessageBubble
          message={item}
          own={own}
          tail={tail}
          status={messageStatus(item, chat.members)}
          senderName={showSender && !grouped ? nameOf(item.senderId) : undefined}
          onRetry={resend}
          onLongPress={item.type === 'system' ? undefined : onLongPress}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={title}
        subtitle={subtitle.text}
        subtitleAccent={subtitle.accent}
        onBack={back}
        left={<Avatar name={title} seed={chat.id} size={40} icon={chat.type === 'channel' ? 'megaphone-outline' : undefined} />}
        onTitlePress={() => push({ name: 'chatInfo', chatId })}
        titleHint={t('chat.info')}
        right={peer ? (
          <>
            <IconButton icon="call-outline" label={t('chat.callAudio')} disabled={inCall} onPress={() => startCall('audio')} />
            <IconButton icon="videocam-outline" label={t('chat.callVideo')} disabled={inCall} onPress={() => startCall('video')} />
          </>
        ) : undefined}
      />
      <ConnectionBanner />
      <View style={styles.list}>
        <FlatList
          data={data}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.older} color={palette.primary} /> : undefined}
          ListEmptyComponent={
            loadError ? (
              <EmptyState inverted error title={t('chat.loadError')} onRetry={load} />
            ) : page?.loaded ? (
              <EmptyState inverted icon="chatbubbles-outline" title={t('chat.empty')} />
            ) : (
              <ActivityIndicator style={styles.older} color={palette.primary} accessibilityLabel={t('common.loading')} />
            )
          }
        />
        {notice ? (
          <View style={styles.notice} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </View>
      {writable ? (
        <Composer
          onSend={(text) => void sendText(chatId, text)}
          onTyping={(on) => setTyping(chatId, on)}
          editing={editing}
          onEdit={submitEdit}
          onCancelEdit={() => setEditing(null)}
        />
      ) : (
        <Text style={styles.readonly}>{t('chat.readonly')}</Text>
      )}
      <ActionSheet
        visible={menuFor !== null}
        title={t('menu.title')}
        preview={menuFor?.content || undefined}
        actions={menuFor ? menuActions(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
    </KeyboardAvoidingView>
  );
};

const createStyles = (p: Palette) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: p.chatBackground },
  list:       { flex: 1 },
  content:    { paddingVertical: space.sm, flexGrow: 1 },
  older:      { marginVertical: space.lg },
  notice: {
    position: 'absolute', top: space.md, alignSelf: 'center', maxWidth: '90%',
    paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radii.full, backgroundColor: 'rgba(0,0,0,0.75)',
  },
  noticeText: { ...textStyles.bodySmall, color: '#FFFFFF', textAlign: 'center' },
  readonly: {
    ...textStyles.bodySmall, padding: space.lg, textAlign: 'center', color: p.textSecondary, backgroundColor: p.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider,
  },
});
