import type { ChatSummary, MessageStatus } from '@suhbat/core';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { space } from '../theme/metrics';
import { textStyles } from '../theme/typography';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/ThemeProvider';
import { formatChatTime, formatCount, messagePreview } from '../utils/format';
import { Avatar } from './Avatar';
import { StatusTick } from './StatusTick';

interface Props {
  chat:     ChatSummary;
  title:    string;
  myId:     string;
  online:   boolean;
  /** Yozayotganlar (guruhda ism bilan). */
  typing:   string | null;
  /** Oxirgi xabar o'zimizniki bo'lsa — uning holati. */
  status:   MessageStatus | null;
  onPress:  (chatId: string) => void;
}

/** Ro'yxat qatori (Telegram uslubi): avatar, nom, vaqt, holat belgisi, oldindan ko'rinish, o'qilmaganlar. */
export const ChatListItem = memo(({ chat, title, myId, online, typing, status, onPress }: Props) => {
  const styles = useStyles(createStyles);
  const { palette } = useTheme();
  const last = chat.lastMessage;
  const own = last?.senderId === myId && last.type !== 'system';
  const sender = !own && chat.type === 'group' && last && last.type !== 'system'
    ? chat.members.find((m) => m.user.id === last.senderId)?.user.displayName.split(' ')[0]
    : undefined;
  const prefix = own && chat.type !== 'channel' ? t('common.you') : sender;
  const preview = last ? messagePreview(last).replace(/\s+/g, ' ') : t('list.noMessages');
  const unread = chat.unreadCount;

  return (
    <Pressable
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
      onPress={() => onPress(chat.id)}
      android_ripple={{ color: palette.surfaceHighlight }}
      accessibilityRole="button"
      accessibilityLabel={[title, typing ?? (prefix ? `${prefix}: ${preview}` : preview), last ? formatChatTime(last.createdAt) : '']
        .filter(Boolean).join(', ')}
      accessibilityHint={unread > 0 ? t('list.unread', { n: unread }) : undefined}
    >
      <Avatar
        name={title}
        seed={chat.id}
        online={online}
        icon={chat.type === 'channel' ? 'megaphone-outline' : undefined}
      />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {own && status && chat.type !== 'channel' ? <StatusTick status={status} color={palette.primary} size={16} /> : null}
          {last ? <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{formatChatTime(last.createdAt)}</Text> : null}
        </View>
        <View style={styles.row}>
          {typing ? (
            <Text style={[styles.preview, styles.typing]} numberOfLines={1}>{typing}</Text>
          ) : (
            <Text style={styles.preview} numberOfLines={1}>
              {prefix ? <Text style={styles.prefix}>{`${prefix}: `}</Text> : null}
              {preview}
            </Text>
          )}
          {unread > 0 ? (
            <View style={styles.badge} accessibilityLabel={t('list.unread', { n: unread })}>
              <Text style={styles.badgeText}>{unread > 999 ? formatCount(unread) : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const createStyles = (p: Palette) => StyleSheet.create({
  root:       { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, paddingRight: space.lg, paddingVertical: space.sm, backgroundColor: p.surface },
  pressed:    { backgroundColor: p.surfaceHighlight },
  body:       { flex: 1, gap: 3, paddingVertical: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title:      { ...textStyles.chatName, flex: 1, color: p.textPrimary },
  time:       { ...textStyles.chatTime, color: p.textSecondary, marginLeft: space.xs },
  timeUnread: { color: p.primary },
  preview:    { ...textStyles.chatPreview, flex: 1, color: p.textSecondary },
  prefix:     { color: p.textPrimary },
  typing:     { color: p.primary },
  badge: {
    minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, marginLeft: space.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: p.unreadBadge,
  },
  badgeText:  { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
